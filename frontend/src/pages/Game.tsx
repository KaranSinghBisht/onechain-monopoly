// /frontend/src/pages/Game.tsx
import { useParams } from "react-router-dom";
import OnePolyGame from "../oneopoly/OnePolyGame";

export default function Game() {
  const { gameId } = useParams();

  if (!gameId) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-lg font-semibold">No Game ID</div>
          <p className="text-sm text-white/70 mt-1">Create a new game or paste a game ID on the home page.</p>
          <a className="inline-block mt-3 rounded-md bg-neon-cyan px-3 py-2 text-sm font-semibold text-background" href="/">
            Go Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <OnePolyGame gameId={gameId} />
    </div>
  );
}
