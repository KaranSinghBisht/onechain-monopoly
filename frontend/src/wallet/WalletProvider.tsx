import React, { createContext, useContext, useEffect, useState } from "react";
import type { Transaction } from "@mysten/sui/transactions";
import { connectWallet, disconnectWallet, listWallets, onWalletsChanged, signOnly } from "./wallet";
import type { WalletAccount, WalletStandard } from "./wallet";
import { getClient } from "../onechain/client";
import { toB64 } from "@mysten/sui/utils";
import { buildConsolidateGasTx } from "./buildConsolidateGasTx";
import { devlog, deverr } from "../lib/devlog";

type WalletCtx = {
  wallets: WalletStandard[];
  wallet: WalletStandard | null;
  account: WalletAccount | null;
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  exec: (tx: Transaction) => Promise<any>;
};

const Ctx = createContext<WalletCtx | null>(null);
const LAST_WALLET_KEY = "oneopoly:lastWallet";

async function rpcCall(method: string, params: any[]) {
  const url = import.meta.env.VITE_ONECHAIN_RPC as string;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method} failed: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function executeTxRaw(txBytes: string, sigs: string[]) {
  const options = {
    showEffects: true,
    showObjectChanges: true,
    showEvents: true,
    showInput: true,
  };

  for (const method of ["sui_executeTransactionBlock", "one_executeTransactionBlock"]) {
    try {
      return await rpcCall(method, [txBytes, sigs, options, "WaitForLocalExecution"]);
    } catch (e) {
      devlog("execute failed for", method, e);
    }
  }
  throw new Error("No executeTransactionBlock method succeeded");
}

// Helper to merge all non-primary gas coins into the largest one
export async function buildConsolidateGasTxForOwner(owner: string) {
  const client = getClient();
  const coinsResp = await client.getCoins({ owner, limit: 50 });
  const sorted = (coinsResp.data ?? [])
    .slice()
    .sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));

  const primary = sorted[0];
  if (!primary) throw new Error("No gas coins found for this address on OneChain testnet");

  const others = sorted.slice(1).map((c) => c.coinObjectId);
  if (!others.length) throw new Error("No additional gas coins to consolidate");

  const tx = buildConsolidateGasTx(others);
  tx.setSender(owner);

  return { tx, primary, others };
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<WalletStandard[]>([]);
  const [wallet, setWallet] = useState<WalletStandard | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  const refresh = () => setWallets(listWallets());

  useEffect(() => {
    refresh();
    return onWalletsChanged(refresh);
  }, []);

  useEffect(() => {
    if (autoTried || account) return;

    let last = "";
    try {
      last = localStorage.getItem(LAST_WALLET_KEY) ?? "";
    } catch {
      // ignore storage errors
    }

    if (!last) {
      setAutoTried(true);
      return;
    }

    const w = wallets.find((x) => x.name === last);
    if (!w) {
      setAutoTried(true);
      return;
    }

    (async () => {
      try {
        const acc = await connectWallet(w, { silent: true });
        setWallet(w);
        setAccount(acc);
      } catch {
        // ignore silent connect errors
      } finally {
        setAutoTried(true);
      }
    })();
  }, [wallets, autoTried, account]);

  const connect = async (walletName?: string) => {
    const all = listWallets();
    const w = (walletName ? all.find((x) => x.name === walletName) : all[0]) ?? null;
    if (!w) throw new Error("No injected wallet found");
    const acc = await connectWallet(w);
    setWallet(w);
    setAccount(acc);
    try {
      localStorage.setItem(LAST_WALLET_KEY, w.name);
    } catch {
      // ignore
    }
  };

  const disconnect = async () => {
    if (wallet) await disconnectWallet(wallet);
    setWallet(null);
    setAccount(null);
    try {
      localStorage.removeItem(LAST_WALLET_KEY);
    } catch {
      // ignore
    }
  };

  const exec = async (tx: Transaction) => {
    if (!wallet || !account) throw new Error("Connect wallet first");

    const client = getClient();

    // Always set sender before building
    tx.setSender(account.address);

    // Fetch gas price (fallback to default if needed)
    let gasPriceNum: number = 1000;

    try {
      const gp: unknown = await client.getReferenceGasPrice();

      // handle bigint | number | string
      if (typeof gp === "bigint") gasPriceNum = Number(gp);
      else if (typeof gp === "number") gasPriceNum = gp;
      else if (typeof gp === "string") gasPriceNum = Number(gp);

      if (!Number.isFinite(gasPriceNum) || gasPriceNum <= 0) gasPriceNum = 1000;

      tx.setGasPrice(gasPriceNum);
    } catch {
      // ignore, keep default
    }

    // Choose gas coins from RPC (avoid wallet doing any lookup)
    const coinsResp = await client.getCoins({ owner: account.address, limit: 50 });
    const all = coinsResp.data ?? [];
    if (!all.length) throw new Error("No gas coins found for this address on OneChain testnet");

    const sorted = all.slice().sort((a, b) => {
      const A = BigInt(a.balance);
      const B = BigInt(b.balance);
      return A === B ? 0 : A < B ? 1 : -1;
    });

    const gasCoin = sorted[0];
    const gasBal = BigInt(gasCoin.balance);

    // choose budget directly in MIST (not divided by gas price)
    const MIN_BUDGET = 10_000_000n; // 0.01 coin
    const CAP_BUDGET = 50_000_000n; // 0.05 coin
    const budget = (() => {
      const tenth = gasBal / 10n;
      const clampedLow = tenth < MIN_BUDGET ? MIN_BUDGET : tenth;
      return clampedLow > CAP_BUDGET ? CAP_BUDGET : clampedLow;
    })();

    devlog("gas", {
      gasCoin: gasCoin.coinObjectId,
      gasBal: gasBal.toString(),
      gasBudget: budget.toString(),
    });

    tx.setGasBudget(Number(budget));
    tx.setGasPayment([{ objectId: gasCoin.coinObjectId, version: gasCoin.version, digest: gasCoin.digest }]);

    const signed: any = await signOnly(wallet as any, account as any, tx);

    const sigs: string[] | undefined = Array.isArray(signed?.signatures)
      ? signed.signatures
      : typeof signed?.signature === "string"
        ? [signed.signature]
        : undefined;

    let txBytes =
      signed?.bytes ??
      signed?.transactionBlock ??
      signed?.transactionBytes ??
      signed?.transactionBlockBytes;

    if (txBytes instanceof Uint8Array) txBytes = toB64(txBytes);

    if (!sigs?.[0] || !txBytes) {
      deverr("signTransaction response:", signed);
      throw new Error("Wallet did not return tx bytes/signature");
    }

    // Optional dryrun on signed bytes (client-compatible)
    const sim = await client.dryRunTransactionBlock({ transactionBlock: txBytes });

    const status: any = sim.effects?.status;
    const gasUsed: any = (sim.effects as any)?.gasUsed;

    devlog("dryrun summary", {
      status,
      errorTopLevel: (sim as any).error,
      gasUsed,
    });

    if (!(status?.status === "success" || status?.status === "Success")) {
      throw new Error(`Dryrun failed: ${status?.error ?? (sim as any).error ?? JSON.stringify(status)}`);
    }

    return executeTxRaw(txBytes, sigs);
  };

  const value = { wallets, wallet, account, connect, disconnect, exec };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}
