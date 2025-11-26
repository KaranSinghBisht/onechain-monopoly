// /frontend/src/pages/Home.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Copy,
  Dices,
  ExternalLink,
  Gamepad2,
  Loader2,
  Network,
  Package,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import ConnectWalletButton from "../components/ConnectWalletButton";
import { buildCreateGameTx, extractCreatedObjectId, getTxByDigest } from "../onechain/ptb";
import { useWallet } from "../wallet/WalletProvider";
import { deverr } from "../lib/devlog";

const pkgId = import.meta.env.VITE_PACKAGE_ID;
const rpc = import.meta.env.VITE_ONECHAIN_RPC;

export default function Home() {
  const nav = useNavigate();
  const { exec, account } = useWallet();

  const [inputId, setInputId] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdGameId, setCreatedGameId] = useState<string>("");
  const [toast, setToast] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const connected = !!account?.address;
  const short = useMemo(() => {
    const a = account?.address ?? "";
    return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Not connected";
  }, [account?.address]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1400);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied!");
    } catch {
      showToast("Copy failed");
    }
  };

  const normalizeId = (s: string) => s.trim();

  const canJoin = useMemo(() => {
    const x = normalizeId(inputId);
    // keep it permissive: users may paste full object id
    return x.length > 10;
  }, [inputId]);

  const createGame = async () => {
    setErr("");
    setBusy(true);
    try {
      const gameId = BigInt(Date.now());
      const tx = buildCreateGameTx(gameId);
      const resp = await exec(tx);

      const newId =
        extractCreatedObjectId(resp, "Game") ??
        extractCreatedObjectId(resp) ??
        (resp?.digest ? extractCreatedObjectId(await getTxByDigest(resp.digest), "Game") : null) ??
        (resp?.digest ? extractCreatedObjectId(await getTxByDigest(resp.digest)) : null);

      if (!newId) {
        throw new Error("Create game tx succeeded but could not find created Game id in objectChanges");
      }

      setCreatedGameId(newId);
      showToast("Lobby created");
    } catch (e: unknown) {
      deverr("createGame failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white">
      {/* background accents */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-neon-cyan/10 blur-3xl" />
        <div className="absolute bottom-[-200px] right-[-200px] h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        {/* top bar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
              <Gamepad2 className="h-5 w-5 text-neon-cyan" />
            </div>
            <div>
              <div className="text-sm text-white/60">OnePoly</div>
              <h1 className="text-xl font-semibold leading-tight">On-chain Monopoly on OneChain</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
              <Network className="h-4 w-4" />
              RPC: <span className="font-mono text-white/90">{rpc ? "connected" : "missing env"}</span>
            </div>
            <ConnectWalletButton />
          </div>
        </div>

        {/* hero */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
              <Sparkles className="h-4 w-4 text-neon-cyan" />
              Fast demo • Shared lobby • Rent + Houses
            </div>

            <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">
              Play. Own tiles. <span className="text-neon-cyan">Charge rent.</span> All on-chain.
            </h2>

            <p className="mt-3 text-sm text-white/70 leading-relaxed">
              Create a lobby, share the link, then start rolling. Purchases, ownership, houses, rent transfers, and
              bankruptcies happen through Move entry functions.
            </p>

            {err && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {err}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-neon-cyan px-4 py-3 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60"
                disabled={!connected || busy}
                onClick={createGame}
                title={!connected ? "Connect wallet first" : ""}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}
                {busy ? "Creating..." : "Create New Game"}
                <ArrowRight className="h-4 w-4" />
              </button>
              {!connected && <div className="text-xs text-white/70">Connect wallet to create a lobby.</div>}

              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                onClick={() => document.getElementById("joinBox")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              >
                Join Existing Game
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>

            {/* how it works */}
            <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Step n="1" title="Create lobby" desc="Generate a shared on-chain Game object." />
              <Step n="2" title="Invite friend" desc="Copy the game ID / link and join." />
              <Step n="3" title="Start + play" desc="Roll, buy, build houses, collect rent." />
            </div>
          </div>

          {/* status / join panel */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-white/90">Network & Package</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                <ShieldCheck className="h-4 w-4 text-neon-cyan" />
                Ready for demo
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <KV icon={<Wallet className="h-4 w-4" />} label="Connected" value={short} mono />
              <KV icon={<Network className="h-4 w-4" />} label="RPC" value={rpc ?? "Not set"} mono />
              <KV icon={<Package className="h-4 w-4" />} label="Package ID" value={pkgId ?? "Not set"} mono />
            </div>

            <div id="joinBox" className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-white/60">Join a game</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  placeholder="Paste Game Object ID..."
                  className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan"
                />
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan px-3 py-2 text-sm font-semibold text-background disabled:opacity-60"
                  disabled={!canJoin}
                  onClick={() => canJoin && nav(`/game/${normalizeId(inputId)}`)}
                >
                  Join
                </button>
              </div>
              <div className="mt-2 text-xs text-white/50">
                Tip: if you created a lobby, you can copy the invite link and open in another browser.
              </div>
            </div>

            {createdGameId && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-white/60">Lobby created</div>
                    <div className="mt-1 break-all font-mono text-sm text-white/90">{createdGameId}</div>
                  </div>
                  <button
                    className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                    onClick={() => copy(createdGameId)}
                    title="Copy Game ID"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={() => copy(`${window.location.origin}/game/${createdGameId}`)}
                  >
                    Copy Invite Link
                  </button>
                  <button
                    className="rounded-lg bg-neon-cyan px-3 py-2 text-sm font-semibold text-background hover:brightness-110"
                    onClick={() => nav(`/game/${createdGameId}`)}
                  >
                    Enter Room
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm text-white/90 backdrop-blur">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function KV({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center gap-2 text-white/70">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-right text-sm ${mono ? "font-mono break-all text-white/90" : "text-white/90"}`}>
        {value}
      </div>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-neon-cyan/20 text-neon-cyan flex items-center justify-center text-sm font-semibold">
          {n}
        </div>
        <div className="text-sm font-semibold text-white/90">{title}</div>
      </div>
      <div className="mt-2 text-xs text-white/60 leading-relaxed">{desc}</div>
    </div>
  );
}
