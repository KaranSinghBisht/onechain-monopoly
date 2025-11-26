// /frontend/src/oneopoly/components/Lobby.tsx
import { useState } from "react";
import { Users, Copy, PlayCircle } from "lucide-react";
import { NeonButton, Card } from "./ui";

interface LobbyProps {
  onJoin: (mode: "host" | "join", joinId?: string) => void;
  disabled?: boolean;
}

export default function Lobby({ onJoin, disabled }: LobbyProps) {
  const [code, setCode] = useState("");

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-surface2 to-background -z-10"></div>
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-neon-cyan/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-deep/5 rounded-full blur-3xl"></div>

      <div className="text-center mb-12">
        <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-4 tracking-tighter">
          ONEPOLY <span className="text-neon-cyan">LOBBY</span>
        </h1>
        <p className="text-text-secondary text-lg max-w-md mx-auto">
          Two-player, on-chain, and unapologetically simple. Bind the shared game object and play.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <Card className="p-8 hover:border-neon-cyan/50 transition-colors group cursor-pointer">
          <div className="h-12 w-12 bg-neon-cyan/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <PlayCircle className="text-neon-cyan w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Host a Game</h2>
          <p className="text-text-muted mb-6">Create a lobby and invite a friend with the shared Game ID.</p>
          <NeonButton onClick={() => onJoin("host")} className="w-full" disabled={disabled}>
            Create Lobby
          </NeonButton>
        </Card>

        <Card className="p-8 hover:border-accent-gold/50 transition-colors group">
          <div className="h-12 w-12 bg-accent-gold/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Users className="text-accent-gold w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Join Game</h2>
          <p className="text-text-muted mb-6">Paste the Game ID to join the shared match.</p>

          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Paste Game ID..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-neon-cyan text-white placeholder-text-muted"
              />
              <button
                type="button"
                className="absolute right-3 top-3.5 text-text-muted hover:text-white"
                onClick={() => navigator.clipboard.writeText(code)}
                title="Copy Game ID"
                aria-label="Copy Game ID"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <NeonButton variant="secondary" onClick={() => onJoin("join", code)} disabled={!code || disabled} className="w-full">
              Enter Room
            </NeonButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
