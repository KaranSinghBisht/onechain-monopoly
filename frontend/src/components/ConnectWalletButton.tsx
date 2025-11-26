// /frontend/src/components/ConnectWalletButton.tsx
import { useMemo, useState } from "react";
import { shortAddr } from "../oneopoly/helpers";
import { useWallet } from "../wallet/WalletProvider";

export default function ConnectWalletButton() {
  const { wallets, account, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const isConnected = !!account?.address;
  const menuOpen = open && !isConnected;

  const title = useMemo(
    () => (wallets.length ? `Found: ${wallets.map((w) => w.name).join(", ")}` : "No wallet found"),
    [wallets]
  );

  if (account?.address) {
    return (
      <button
        className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
        onClick={disconnect}
        title={account.address}
      >
        {shortAddr(account.address)} · Disconnect
      </button>
    );
  }

  const onClickPrimary = async () => {
    if (wallets.length <= 1) return connect(wallets[0]?.name);
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        className="rounded-md bg-neon-cyan px-3 py-2 text-sm font-semibold text-background disabled:opacity-60"
        disabled={wallets.length === 0}
        onClick={onClickPrimary}
        title={title}
      >
        {wallets.length ? "Connect Wallet" : "No Wallet Found"}
      </button>
      {wallets.length === 0 && (
        <div className="mt-1 text-[11px] text-white/60">OneWallet not detected — install/enable the extension.</div>
      )}

      {menuOpen && wallets.length > 1 && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-black/90 backdrop-blur p-1 shadow-xl z-50">
          {wallets.map((w) => (
            <button
              key={w.name}
              className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-white/10"
              onClick={() => connect(w.name)}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
