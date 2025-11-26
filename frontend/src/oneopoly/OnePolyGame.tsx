// /frontend/src/oneopoly/OnePolyGame.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Copy, Dices, DollarSign, X } from "lucide-react";
import { fetchObject } from "../onechain/client";
import { INITIAL_BOARD, INITIAL_PLAYERS } from "./constants";
import Board from "./components/Board";
import { Badge, Card, NeonButton } from "./components/ui";
import { TileType } from "./types";
import type { ChainGameFields, GameEvent, GameState, Tile } from "./types";
import { shortAddr } from "./helpers";
import { useWallet } from "../wallet/WalletProvider";
import {
  buildBuyPropertyTx,
  buildBuyHouseTx,
  buildJoinGameTx,
  buildNextTurnTx,
  buildRollDiceTx,
  buildSellHouseTx,
  buildStartGameTx,
} from "../onechain/ptb";
import ConnectWalletButton from "../components/ConnectWalletButton";

const seedState: GameState = {
  status: "lobby",
  turn: 0,
  hasRolled: false,
  players: INITIAL_PLAYERS,
  board: INITIAL_BOARD,
  dice: [1, 1],
  history: [],
};

type GameSnapshot = {
  started: boolean;
  currentPlayer: number;
  hasRolled: boolean;
  players: { addr: string; money: number; pos: number; active: boolean }[];
  props: { owner: string; price: number; houses: number }[];
};

export default function OnePolyGame({ gameId }: { gameId?: string }) {
  const [gameState, setGameState] = useState<GameState>(seedState);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [lobbyBusy, setLobbyBusy] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const prevSnapRef = useRef<GameSnapshot | null>(null);
  const lastRpcErrRef = useRef<string>("");
  const { account, exec } = useWallet();
  const userAddr = account?.address?.toLowerCase() ?? "";

  const query = useQuery({
    queryKey: ["game-object", gameId],
    queryFn: async () => {
      if (!gameId) throw new Error("gameId not set (route param required)");
      const res = await fetchObject<{ fields?: ChainGameFields }>(gameId);
      return res;
    },
    refetchInterval: 10_000,
    enabled: !!gameId,
  });

  useEffect(() => {
    const msg = query.isError ? String(query.error) : "";
    if (!msg) return;
    if (lastRpcErrRef.current === msg) return;
    lastRpcErrRef.current = msg;
    addLog(`RPC error: ${msg}`, "error");
  }, [query.isError, query.error]);

  const onChainFields = query.data?.fields;
  const parsedGame = useMemo(() => parseGame(onChainFields), [onChainFields]);
  const mergedPlayers = useMemo(() => derivePlayers(onChainFields), [onChainFields]);
  const mergedBoard = useMemo(() => deriveBoard(onChainFields, mergedPlayers), [onChainFields, mergedPlayers]);
  const chainProps = useMemo(() => readVec<any>((onChainFields as any)?.props), [onChainFields]);
  const chainPlayers = useMemo(() => {
    return readVec<any>((onChainFields as any)?.player_addrs)
      .map(asAddr)
      .filter((a) => a && !isZeroAddr(a));
  }, [onChainFields]);
  const viewerIndex = useMemo(() => {
    if (!userAddr) return -1;
    return chainPlayers.indexOf(userAddr);
  }, [chainPlayers, userAddr]);
  const playerCount = chainPlayers.length || 1;
  const currentTurn = normalizeTurn(readNum(onChainFields?.current_player ?? gameState.turn), playerCount);
  const startedOnChain = readBool(onChainFields?.started);
  const hasRolledOnChain = readBool(onChainFields?.has_rolled);
  const isMyTurn = viewerIndex >= 0 && viewerIndex === currentTurn;
  const canRoll = startedOnChain && isMyTurn && !hasRolledOnChain;
  const txTag = import.meta.env.DEV ? " (tx submitted)" : "";

  useEffect(() => {
    setGameState((prev) => ({
      ...prev,
      status: startedOnChain ? "playing" : "lobby",
      turn: currentTurn,
      hasRolled: hasRolledOnChain,
      players: mergedPlayers,
      board: mergedBoard,
    }));
  }, [onChainFields, mergedPlayers, mergedBoard, currentTurn, startedOnChain, hasRolledOnChain]);

  useEffect(() => {
    const nextSnap = buildSnapshot(onChainFields);
    const prevSnap = prevSnapRef.current;

    if (!nextSnap) return;

    if (!prevSnap) {
      prevSnapRef.current = nextSnap;
      return;
    }

    if (!prevSnap.started && nextSnap.started) {
      addLog(`Game started. ${nameOf(nextSnap.players[nextSnap.currentPlayer]?.addr, nextSnap)} begins.`, "info");
    }

    if (prevSnap.currentPlayer !== nextSnap.currentPlayer) {
      addLog(`Turn → ${nameOf(nextSnap.players[nextSnap.currentPlayer]?.addr, nextSnap)}`, "info");
    }

    const N = Math.min(prevSnap.props.length, nextSnap.props.length);
    for (let i = 0; i < N; i++) {
      const a = prevSnap.props[i];
      const b = nextSnap.props[i];
      const tileName = INITIAL_BOARD[i]?.name ?? `tile ${i}`;

      if (a.owner !== b.owner) {
        if (isZeroOwner(a.owner) && !isZeroOwner(b.owner) && b.price > 0) {
          addLog(`${nameOf(b.owner, nextSnap)} bought ${tileName} for $${b.price}.`, "info");
        }
        if (!isZeroOwner(a.owner) && isZeroOwner(b.owner)) {
          addLog(`${tileName} returned to bank (was owned by ${nameOf(a.owner, prevSnap)}).`, "info");
        }
      }

      if (a.houses !== b.houses) {
        addLog(
          `${nameOf(b.owner, nextSnap)} ${b.houses > a.houses ? "built" : "sold"} on ${tileName} (houses: ${a.houses} → ${b.houses}).`,
          "info"
        );
      }
    }

    const deltas = nextSnap.players.map((p, idx) => ({
      idx,
      addr: p.addr,
      d: (p.money ?? 0) - (prevSnap.players[idx]?.money ?? 0),
    }));

    const payers = deltas.filter((x) => x.d < 0);
    const receivers = deltas.filter((x) => x.d > 0);

    if (payers.length === 1 && receivers.length === 1 && Math.abs(payers[0].d) === receivers[0].d) {
      const amt = receivers[0].d;
      addLog(`${nameOf(payers[0].addr, nextSnap)} paid $${amt} to ${nameOf(receivers[0].addr, nextSnap)}.`, "rent");
    }

    nextSnap.players.forEach((p, idx) => {
      const was = prevSnap.players[idx];
      if (was?.active && !p.active) {
        addLog(`${nameOf(p.addr, nextSnap)} went bankrupt.`, "error");
      }
    });

    prevSnapRef.current = nextSnap;
  }, [onChainFields]);

  const currentPlayer = gameState.players[currentTurn] ?? gameState.players[0];
  const currentTile = gameState.board.find((t) => t.id === currentPlayer.position) ?? gameState.board[0];

  const addLog = (text: string, type: GameEvent["type"] = "info") => {
    const newEvent: GameEvent = {
      id: crypto.randomUUID(),
      text,
      type,
      timestamp: Date.now(),
    };
    setGameState((prev) => ({ ...prev, history: [newEvent, ...prev.history].slice(0, 20) }));
  };

  // --- Actions ---
  const rollDice = async () => {
    if (!gameId) return addLog("No game id in route", "error");
    if (!userAddr) return addLog("Connect wallet first.", "error");
    if (!canRoll) return addLog("You can't roll right now.", "error");

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);

    setIsProcessing(true);
    try {
      await exec(buildRollDiceTx(gameId, d1, d2));
      addLog(`Rolled ${d1} + ${d2}${txTag}`, "info");
      setGameState((prev) => ({ ...prev, dice: [d1, d2] }));
      await query.refetch();
    } catch (e) {
      addLog(`Roll failed: ${String(e)}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const buyProperty = async () => {
    if (!gameId) return addLog("No game id in route", "error");
    if (!userAddr) return addLog("Connect wallet first.", "error");
    if (!startedOnChain) return addLog("Game not started.", "error");
    if (!isMyTurn) return addLog("Not your turn.", "error");

    const tileIndex = Number(currentTile.id);
    const pf =
      chainProps[tileIndex] && typeof chainProps[tileIndex] === "object" && "fields" in chainProps[tileIndex]
        ? (chainProps[tileIndex] as any).fields
        : chainProps[tileIndex];
    const chainPrice = readNum(pf?.price);
    const canBuyOnChain = chainPrice > 0;

    if (currentTile.type !== TileType.PROPERTY) return addLog("Not on a property tile.", "error");
    if (currentTile.owner != null) return addLog("That property is already owned.", "error");
    if (!canBuyOnChain) return addLog("This property is not purchasable on-chain.", "error");
    const tileName = currentTile?.name ?? `tile ${tileIndex}`;

    setIsProcessing(true);
    try {
      await exec(buildBuyPropertyTx(gameId, tileIndex));
      addLog(`Bought ${tileName} for $${chainPrice}${txTag}`, "buy");
      await query.refetch();
    } catch (e) {
      addLog(`Buy failed: ${String(e)}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const buyHouse = async () => {
    if (!gameId) return addLog("No game id in route", "error");
    if (!userAddr) return addLog("Connect wallet first.", "error");
    if (!startedOnChain) return addLog("Game not started.", "error");
    if (!isMyTurn) return addLog("Not your turn.", "error");
    if (currentTile.type !== TileType.PROPERTY) return addLog("Not on a property tile.", "error");
    if (currentTile.owner !== viewerIndex) return addLog("You don't own this property.", "error");

    const tileIndex = Number(currentTile.id);
    const tileName = currentTile?.name ?? `tile ${tileIndex}`;

    setIsProcessing(true);
    try {
      await exec(buildBuyHouseTx(gameId, tileIndex));
      addLog(`Bought house on ${tileName}${txTag}`, "buy");
      await query.refetch();
    } catch (e) {
      addLog(`Buy house failed: ${String(e)}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const sellHouse = async () => {
    if (!gameId) return addLog("No game id in route", "error");
    if (!userAddr) return addLog("Connect wallet first.", "error");
    if (!startedOnChain) return addLog("Game not started.", "error");
    if (!isMyTurn) return addLog("Not your turn.", "error");
    if (currentTile.type !== TileType.PROPERTY) return addLog("Not on a property tile.", "error");
    if (currentTile.owner !== viewerIndex) return addLog("You don't own this property.", "error");
    if (!currentTile.houses || currentTile.houses <= 0) return addLog("No houses to sell here.", "error");

    const tileIndex = Number(currentTile.id);
    const tileName = currentTile?.name ?? `tile ${tileIndex}`;

    setIsProcessing(true);
    try {
      await exec(buildSellHouseTx(gameId, tileIndex));
      addLog(`Sold house on ${tileName}${txTag}`, "info");
      await query.refetch();
    } catch (e) {
      addLog(`Sell house failed: ${String(e)}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const endTurn = async () => {
    if (!gameId) return addLog("No game id in route", "error");
    if (!userAddr) return addLog("Connect wallet first.", "error");
    if (!startedOnChain) return addLog("Game not started.", "error");
    if (!isMyTurn) return addLog("Not your turn.", "error");
    if (!hasRolledOnChain) return addLog("Roll first.", "error");

    setIsProcessing(true);
    try {
      await exec(buildNextTurnTx(gameId));
      addLog(`Ended turn${txTag}`, "info");
      await query.refetch();
    } catch (e) {
      addLog(`End turn failed: ${String(e)}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const isHost = !!userAddr && userAddr === parsedGame.host;
  const viewerJoined = parsedGame.effectivePlayers.includes(userAddr);
  const canJoinAsGuest = !parsedGame.started && !isHost && !viewerJoined && parsedGame.effectivePlayers.length < 2;
  const canConfirmHostSeat = !parsedGame.started && isHost && !parsedGame.hostJoinedOnChain;
  const canStart = !parsedGame.started && isHost && parsedGame.effectivePlayers.length >= 2;
  const ownsCurrentProperty =
    currentTile.type === TileType.PROPERTY && typeof currentTile.owner === "number" && currentTile.owner === viewerIndex;
  const currentProp =
    chainProps[Number(currentTile.id)] && typeof chainProps[Number(currentTile.id)] === "object" && "fields" in chainProps[Number(currentTile.id)]
      ? (chainProps[Number(currentTile.id)] as any).fields
      : chainProps[Number(currentTile.id)];
  const chainPriceForTile = readNum(currentProp?.price);

  const rollHint = !startedOnChain ? "Game not started" : !isMyTurn ? "Not your turn" : hasRolledOnChain ? "Already rolled" : "";
  const buyHint =
    !startedOnChain
      ? "Game not started"
      : !isMyTurn
        ? "Not your turn"
        : currentTile.type !== TileType.PROPERTY
          ? "Not on a property"
          : currentTile.owner != null
            ? "Already owned"
            : chainPriceForTile <= 0
              ? "Not purchasable"
              : "";
  const buyHouseHint =
    !startedOnChain
      ? "Game not started"
      : !isMyTurn
        ? "Not your turn"
        : currentTile.type !== TileType.PROPERTY
          ? "Not on a property"
          : !ownsCurrentProperty
            ? "You don't own this property"
            : "";
  const sellHouseHint =
    !startedOnChain
      ? "Game not started"
      : !isMyTurn
        ? "Not your turn"
        : currentTile.type !== TileType.PROPERTY
          ? "Not on a property"
          : !ownsCurrentProperty
            ? "You don't own this property"
            : !currentTile.houses || currentTile.houses <= 0
              ? "No houses to sell"
              : "";
  const endTurnHint =
    !startedOnChain ? "Game not started" : !isMyTurn ? "Not your turn" : !hasRolledOnChain ? "Roll first" : "";

  const joinLobby = async () => {
    if (!userAddr) return addLog("Connect wallet first.", "error");
    if (!gameId) return addLog("No game id in route", "error");

    setLobbyBusy(true);
    try {
      const piece = isHost ? 0 : 1;
      const tx = buildJoinGameTx(gameId, piece);
      await exec(tx);
      addLog(isHost ? "Host seat confirmed." : "Joined game.", "info");
      await query.refetch();
    } catch (e) {
      addLog(`Join failed: ${String(e)}`, "error");
    } finally {
      setLobbyBusy(false);
    }
  };

  const startGame = async () => {
    if (!userAddr) {
      addLog("Connect wallet first.", "error");
      return;
    }
    if (!gameId) {
      addLog("No game id in route", "error");
      return;
    }
    setLobbyBusy(true);
    try {
      const tx = buildStartGameTx(gameId);
      await exec(tx);
      addLog("Start game submitted.", "info");
      await query.refetch();
    } catch (e) {
      addLog(`Start failed: ${String(e)}`, "error");
    } finally {
      setLobbyBusy(false);
    }
  };

  if (gameState.status === "lobby") {
    return (
      <div className="min-h-screen bg-background text-white p-4 md:p-8 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold">Game Lobby</h1>
            <div className="text-sm text-white/60">Waiting for players to join</div>
          </div>
          <div className="flex items-center gap-2">
            <ConnectWalletButton />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="rounded border border-white/10 px-3 py-2 bg-white/5">
              Game ID: <span className="font-mono break-all">{gameId}</span>
            </div>
            <button
              className="rounded bg-white/10 px-3 py-2 text-sm"
              onClick={() => navigator?.clipboard?.writeText?.(gameId ?? "")}
            >
              Copy ID
            </button>
            <button
              className="rounded bg-white/10 px-3 py-2 text-sm"
              onClick={() => navigator?.clipboard?.writeText?.(`${window.location.origin}/game/${gameId ?? ""}`)}
            >
              Copy Link
            </button>
          </div>
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase text-white/60">Host</div>
              <div className="font-mono">{parsedGame.host ? shortAddr(parsedGame.host) : "Unknown"}</div>
            </div>
            <div className="text-sm text-white/70">
              Players: {parsedGame.effectivePlayers.length}/2 {parsedGame.started && "(started)"}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase text-white/60">Player 1 (Host)</div>
              <div className="mt-1 font-mono break-all text-sm">{parsedGame.seat1 || "Empty slot"}</div>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase text-white/60">Player 2</div>
              <div className="mt-1 font-mono break-all text-sm">{parsedGame.seat2 || "Empty slot"}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canConfirmHostSeat && (
              <NeonButton onClick={joinLobby} disabled={lobbyBusy} className="px-4 py-2">
                Confirm Host Seat
              </NeonButton>
            )}

            {canJoinAsGuest && (
              <NeonButton onClick={joinLobby} disabled={lobbyBusy} className="px-4 py-2">
                Join Game
              </NeonButton>
            )}

            <NeonButton onClick={startGame} disabled={!canStart || lobbyBusy} className="px-4 py-2">
              {parsedGame.effectivePlayers.length < 2 ? "Waiting for Player 2…" : "Start Game"}
            </NeonButton>

            {lobbyBusy && <Badge type="warning">Waiting for wallet / network…</Badge>}
          </div>

          <Card className="p-3">
            <div className="text-xs uppercase text-white/60 mb-2">Lobby Log</div>
            <div className="space-y-2 text-sm">
              {gameState.history.slice(0, 6).map((e) => (
                <div key={e.id} className={e.type === "error" ? "text-accent-rose" : "text-white/80"}>
                  {e.text}
                </div>
              ))}
            </div>
          </Card>
        </Card>
      </div>
    );
  }

  const TX_WIRED = true;

  const rpcStatus = query.isError ? "RPC status: error" : query.isSuccess ? "RPC status: connected" : "RPC status: loading";

  return (
    <div className="min-h-screen bg-background text-text-primary p-2 md:p-6 font-body flex flex-col md:flex-row gap-4 max-w-7xl mx-auto">
      <div className="flex-1 flex flex-col gap-4">
        <header className="flex justify-between items-center bg-surface p-4 rounded-xl border border-border">
          <div>
            <h2 className="text-xl font-display font-bold text-white">OnePoly</h2>
            <div className="text-xs text-text-muted">Turn: P{currentTurn} | Started: {String(onChainFields?.started ?? false)}</div>
          </div>
          <div className="text-sm text-text-secondary">{rpcStatus}</div>
        </header>

        <Board tiles={gameState.board} players={gameState.players} currentPlayerId={currentTurn} onTileClick={setSelectedTile} />
      </div>

      <div className="w-full md:w-[360px] flex flex-col gap-4 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
          {gameState.players.map((p, idx) => (
            <Card
              key={p.id ?? idx}
              className={`p-4 transition-all duration-300 ${idx === currentTurn ? "border-neon-cyan shadow-neon" : "opacity-80"}`}
            >
              <div className="relative mb-2 min-w-0">
                <div className="text-xs text-text-secondary font-mono truncate pr-10" title={p.address}>
                  {shortAddr(p.address)}
                </div>
                <button
                  type="button"
                  className="absolute top-0 right-0 text-text-muted hover:text-white transition-colors"
                  onClick={() => navigator?.clipboard?.writeText?.(p.address ?? "")}
                  title="Copy address"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <div className="font-bold text-white flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: p.color }}></div>
                  {p.name}
                </div>
                {idx === currentTurn && <Badge type="warning">Turn</Badge>}
              </div>
              <div className="flex items-center gap-1 text-2xl font-mono text-accent-green">
                <DollarSign className="w-5 h-5" />
                {p.money ?? 0}
              </div>
              <div className="text-xs text-text-muted mt-1">Pos: {p.position ?? 0} | Active: {String(p.isActive)}</div>
            </Card>
          ))}
        </div>

        <Card className="p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <span className="text-sm uppercase tracking-widest text-text-muted font-bold">Actions</span>
            <div className="flex gap-2">
              <div className="w-8 h-8 bg-black rounded border border-white/20 flex items-center justify-center font-bold font-mono">
                {gameState.dice[0]}
              </div>
              <div className="w-8 h-8 bg-black rounded border border-white/20 flex items-center justify-center font-bold font-mono">
                {gameState.dice[1]}
              </div>
            </div>
          </div>

          <NeonButton onClick={rollDice} disabled={!TX_WIRED || isProcessing || !canRoll} className="group">
            <Dices className="w-5 h-5" />
            Roll Dice
            <span className="text-[10px] text-text-muted ml-2">{rollHint}</span>
          </NeonButton>

          <NeonButton
            variant="secondary"
            onClick={buyProperty}
            disabled={
              !TX_WIRED ||
              isProcessing ||
              !isMyTurn ||
              currentTile.type !== TileType.PROPERTY ||
              currentTile.owner != null ||
              chainPriceForTile <= 0
            }
            className="group"
          >
            Buy {currentTile.type === TileType.PROPERTY ? currentTile.name : "Property"}
            <span className="text-[10px] text-text-muted ml-2">{buyHint}</span>
          </NeonButton>

          <NeonButton
            variant="secondary"
            onClick={buyHouse}
            disabled={
              !TX_WIRED ||
              isProcessing ||
              !isMyTurn ||
              currentTile.type !== TileType.PROPERTY ||
              !ownsCurrentProperty
            }
            className="group"
          >
            Buy House
            <span className="text-[10px] text-text-muted ml-2">{buyHouseHint}</span>
          </NeonButton>

          <NeonButton
            variant="ghost"
            onClick={sellHouse}
            disabled={
              !TX_WIRED ||
              isProcessing ||
              !isMyTurn ||
              currentTile.type !== TileType.PROPERTY ||
              !ownsCurrentProperty ||
              !currentTile.houses ||
              currentTile.houses <= 0
            }
            className="border border-white/10 group"
          >
            Sell House
            <span className="text-[10px] text-text-muted ml-2">{sellHouseHint}</span>
          </NeonButton>

          <NeonButton
            variant="ghost"
            onClick={endTurn}
            disabled={!TX_WIRED || isProcessing || !isMyTurn || !hasRolledOnChain}
            className="border border-white/10 group"
          >
            End Turn
            <span className="text-[10px] text-text-muted ml-2">{endTurnHint}</span>
          </NeonButton>
        </Card>

        <Card className="flex-1 min-h-[200px] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border bg-surface2/50 flex items-center gap-2">
            <Activity className="w-4 h-4 text-neon-cyan" />
            <span className="text-sm font-bold">Activity Log</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {gameState.history.length === 0 && <div className="text-center text-text-muted text-sm mt-4 italic">Awaiting data...</div>}
            {gameState.history.map((event) => (
              <div key={event.id} className="text-sm animate-fade-in-up">
                <div className="flex gap-2">
                  <span className="text-text-muted text-xs font-mono mt-0.5">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" })}
                  </span>
                  <div className={event.type === "error" ? "text-accent-rose" : "text-text-primary"}>{event.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {selectedTile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTile(null)}>
          <div
            className="bg-surface border border-border w-full max-w-xs rounded-2xl shadow-2xl p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setSelectedTile(null)} className="absolute top-4 right-4 text-text-muted hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="text-xs font-bold tracking-widest text-text-muted uppercase mb-1">{selectedTile.type}</div>
              <h3 className="text-2xl font-display font-bold text-white">{selectedTile.name}</h3>
            </div>

            {selectedTile.type === TileType.PROPERTY && selectedTile.data ? (
              <div className="space-y-4">
                <div className="h-4 w-full rounded" style={{ background: selectedTile.data.groupColor }}></div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-text-secondary">Price</span>
                  <span className="font-mono font-bold text-xl">${selectedTile.data.price}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-text-secondary">Rent</span>
                  <span className="font-mono text-white">${selectedTile.data.rent}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-text-secondary">Owner</span>
                  {selectedTile.owner !== undefined && selectedTile.owner !== null ? (
                    <Badge>{gameState.players.find((p) => p.id === selectedTile.owner)?.name ?? "P?"}</Badge>
                  ) : (
                    <span className="text-text-muted italic">Unowned</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-text-muted py-4">Details not available for this tile type.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeTurn(val: number, playerCount: number) {
  if (!Number.isFinite(val) || playerCount <= 0) return 0;
  const x = Math.floor(val);
  return ((x % playerCount) + playerCount) % playerCount;
}

function derivePlayers(fields?: ChainGameFields) {
  const base = INITIAL_PLAYERS.map((p) => ({ ...p }));
  if (!fields) return base;

  const addresses = readVec<string>((fields as any).player_addrs);
  const money = readVec<any>((fields as any).money).map(readNum);
  const positions = readVec<any>((fields as any).positions).map(readNum);
  const active = readVec<any>((fields as any).active).map(readBool);

  return base.map((p, idx) => ({
    ...p,
    address: addresses[idx] ?? p.address,
    name: `Player ${idx}`,
    money: money[idx] ?? p.money,
    position: positions[idx] ?? p.position,
    isActive: active[idx] ?? p.isActive,
  }));
}

function deriveBoard(fields: ChainGameFields | undefined, players: ReturnType<typeof derivePlayers>) {
  const board = INITIAL_BOARD.map((t) => ({
    ...t,
    owner: t.type === TileType.PROPERTY ? (t as any).owner ?? null : (t as any).owner,
    houses: (t as any).houses ?? 0,
  }));
  const props = readVec<any>((fields as any)?.props);
  if (!props || props.length === 0) return board;

  const propertyTiles = board.filter((t) => t.type === TileType.PROPERTY);

  const applyProp = (tile: (typeof board)[number], p: any) => {
    if (!tile || tile.type !== TileType.PROPERTY) return;

    const pf = p && typeof p === "object" && "fields" in p ? (p as any).fields : p;

    const ownerAddr: string | undefined = pf?.owner;
    const houses: number = readNum(pf?.houses);
    const price: number = readNum(pf?.price);

    if (Number.isFinite(price)) {
      tile.data = { ...(tile.data ?? { price: 0, rent: 0, groupColor: "#22D3EE" }), price };
    }
    if (Number.isFinite(houses)) tile.houses = houses;

    const ownerStr = ownerAddr ? String(ownerAddr).toLowerCase() : "";
    const isZeroOwner = ownerStr === "0x0" || ownerStr === "0x00" || /^0x0+$/.test(ownerStr.replace(/^0x/, ""));

    if (!ownerAddr || isZeroOwner) {
      tile.owner = null;
      return;
    }

    const ownerIdx = players.findIndex((pl) => pl.address?.toLowerCase() === ownerStr);
    tile.owner = ownerIdx >= 0 ? ownerIdx : null;
  };

  if (props.length === board.length) {
    props.forEach((p: any, idx: number) => applyProp(board[idx], p));
    return board;
  }

  if (props.length === propertyTiles.length) {
    props.forEach((p: any, idx: number) => applyProp(propertyTiles[idx], p));
    return board;
  }

  return board;
}

function asAddr(x: any): string {
  if (!x) return "";
  if (typeof x === "string") return x.toLowerCase();
  if (typeof x === "object" && "Some" in x) return String((x as any).Some ?? "").toLowerCase();
  return String(x).toLowerCase();
}

function isZeroAddr(a: string) {
  const x = a.toLowerCase();
  return x === "0x0" || x === "0x00" || /^0x0+$/.test(x.replace(/^0x/, ""));
}

function uniq(xs: string[]) {
  return Array.from(new Set(xs.filter(Boolean)));
}

function pickVec(fields: any): any[] {
  const v =
    fields?.player_addrs ??
    fields?.players ??
    fields?.player_addresses ??
    fields?.playerAddresses;
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object" && Array.isArray((v as any).vec)) return (v as any).vec;
  return [];
}

function readBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const x: any = v ?? {};
  if (typeof x === "object" && x?.fields && "value" in x.fields) return !!x.fields.value;
  if (typeof x === "object" && "value" in x) return !!x.value;
  return false;
}

function readNum(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  const x: any = v ?? {};
  if (typeof x === "object" && x?.fields && "value" in x.fields) return Number(x.fields.value);
  if (typeof x === "object" && "value" in x) return Number(x.value);
  return 0;
}

function readVec<T>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object" && Array.isArray((v as any).vec)) return (v as any).vec as T[];
  if (v && typeof v === "object" && (v as any).fields && Array.isArray((v as any).fields.vec)) return (v as any).fields.vec as T[];
  return [];
}

function buildSnapshot(fields?: ChainGameFields): GameSnapshot | null {
  if (!fields) return null;

  const f: any = fields;
  const started = readBool(f.started);
  const currentPlayer = readNum(f.current_player);
  const hasRolled = readBool(f.has_rolled);

  const addrs = readVec<any>(f.player_addrs).map(asAddr);
  const money = readVec<any>(f.money).map(readNum);
  const pos = readVec<any>(f.positions).map(readNum);
  const active = readVec<any>(f.active).map(readBool);

  const players = addrs.map((addr, i) => ({
    addr,
    money: money[i] ?? 0,
    pos: pos[i] ?? 0,
    active: active[i] ?? true,
  }));

  const rawProps = readVec<any>(f.props);
  const props = rawProps.map((p: any) => {
    const pf = p && typeof p === "object" && "fields" in p ? (p as any).fields : p;
    return {
      owner: asAddr(pf?.owner),
      price: readNum(pf?.price),
      houses: readNum(pf?.houses),
    };
  });

  return { started, currentPlayer, hasRolled, players, props };
}

function nameOf(addr: string, snap: GameSnapshot) {
  const idx = snap.players.findIndex((p) => p.addr?.toLowerCase() === addr?.toLowerCase());
  return idx >= 0 ? `Player ${idx}` : addr ? addr.slice(0, 6) + "…" : "Unknown";
}

function isZeroOwner(addr: string) {
  const x = (addr ?? "").toLowerCase();
  return x === "0x0" || x === "0x00" || /^0x0+$/.test(x.replace(/^0x/, ""));
}

function parseGame(fields?: ChainGameFields) {
  const f: any = fields ?? {};
  const host = asAddr(f.host ?? f.creator ?? f.owner ?? "");

  const vecJoiners = pickVec(f).map(asAddr).filter((a) => a && !isZeroAddr(a));

  const p1 = asAddr(f.p1 ?? f.player1 ?? f.player_1 ?? "");
  const p2 = asAddr(f.p2 ?? f.player2 ?? f.player_2 ?? "");
  const pairJoiners = [p1, p2].filter((a) => a && !isZeroAddr(a));

  const joiners = uniq([...vecJoiners, ...pairJoiners]);

  const started =
    f.started === true ||
    (typeof f.started === "object" && f.started?.fields?.value === true);

  const effectivePlayers = uniq([host, ...joiners]).filter((a) => a && !isZeroAddr(a));
  const hostJoinedOnChain = !!host && joiners.includes(host);

  const seat1 = host || joiners[0] || "";
  const seat2 = effectivePlayers.find((a) => a && a !== seat1) || "";

  return { host, joiners, effectivePlayers, hostJoinedOnChain, seat1, seat2, started, rawFields: fields };
}
