// /frontend/src/App.tsx
import { Link, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Game from "./pages/Game";

export default function App() {
  const rpc = import.meta.env.VITE_ONECHAIN_RPC as string | undefined;
  const rpcStatus = rpc ? "RPC status: connected" : "RPC status: not configured";

  return (
    <div className="min-h-screen bg-background text-text-primary font-body">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <header className="flex items-center justify-between pb-6 border-b border-white/10">
          <div>
            <Link to="/" className="text-xl font-semibold tracking-tight">
              OnePoly
            </Link>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-white/70">{rpcStatus}</div>
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/" className="hover:text-cyan-300 transition-colors">
                Home
              </Link>
            </nav>
          </div>
        </header>

        <main className="pt-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game/:gameId" element={<Game />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
