import { getWallets } from "@mysten/wallet-standard";
import type { Transaction } from "@mysten/sui/transactions";
import { devlog } from "../lib/devlog";

export type WalletAccount = { address: string; chains?: string[] };

export type WalletStandard = {
  name: string;
  features: Record<string, any>;
  accounts?: WalletAccount[];
};

const CHAIN = import.meta.env.VITE_WALLET_CHAIN as string | undefined;

function pickFeature(wallet: WalletStandard, names: string[]) {
  for (const n of names) {
    const f = wallet.features?.[n];
    if (f) return f;
  }
  return undefined;
}

function isCompatible(wallet: WalletStandard) {
  const hasConnect = !!pickFeature(wallet, ["standard:connect"])?.connect;
  const hasSign = !!pickFeature(wallet, ["one:signTransaction", "sui:signTransaction"])?.signTransaction;
  return hasConnect && hasSign;
}

function scoreWalletName(name: string) {
  const n = name.toLowerCase();
  if (n.includes("onewallet")) return 100;
  if (n.includes("sui")) return 50;
  if (n.includes("brave")) return -100;
  return 0;
}

export function listWallets(): WalletStandard[] {
  const all = getWallets().get() as unknown as WalletStandard[];
  const isOneWallet = (w: WalletStandard) => {
    const n = (w.name ?? "").toLowerCase();
    const compact = n.replace(/\s+/g, "");
    return compact.includes("onewallet");
  };

  return all.filter(isCompatible).filter(isOneWallet);
}

export function onWalletsChanged(cb: () => void) {
  const wallets = getWallets();
  const off1 = wallets.on("register", cb);
  const off2 = wallets.on("unregister", cb);
  return () => {
    off1();
    off2();
  };
}

export async function connectWallet(wallet: WalletStandard, opts?: { silent?: boolean }): Promise<WalletAccount> {
  const connect = pickFeature(wallet, ["standard:connect"])?.connect;
  if (!connect) throw new Error("Wallet does not support standard:connect");

  const res = await connect({ silent: opts?.silent ?? false });
  const account = (res?.accounts?.[0] ?? wallet.accounts?.[0]) as WalletAccount | undefined;
  if (!account?.address) throw new Error("No account returned from wallet");

  // Log wallet-provided chains for debugging
  devlog("ACCOUNT CHAINS:", account.chains);

  return account;
}

export async function disconnectWallet(wallet: WalletStandard): Promise<void> {
  const disconnect = pickFeature(wallet, ["standard:disconnect"])?.disconnect;
  if (!disconnect) return;
  await disconnect();
}

export async function signOnly(wallet: WalletStandard, account: WalletAccount, tx: Transaction): Promise<any> {
  const feat = pickFeature(wallet, ["one:signTransaction", "sui:signTransaction"]);
  if (!feat?.signTransaction) throw new Error("Wallet does not support signTransaction");

  if (CHAIN) {
    try {
      return await feat.signTransaction({ transaction: tx as any, account, chain: CHAIN });
    } catch (e) {
      devlog("signTransaction w/ chain failed, retrying without chain:", e);
    }
  }

  return feat.signTransaction({ transaction: tx as any, account });
}
