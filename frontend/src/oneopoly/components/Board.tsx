// /frontend/src/oneopoly/components/Board.tsx
import { AlertOctagon, Car, Lock } from "lucide-react";
import { TileType } from "../types";
import type { Player, Tile } from "../types";

interface BoardProps {
  tiles: Tile[];
  players: Player[];
  currentPlayerId: number;
  onTileClick: (tile: Tile) => void;
}

// Position helpers for 6x6 perimeter board
const getGridStyle = (index: number) => {
  if (index >= 0 && index <= 5) return { gridColumn: `${6 - index}`, gridRow: "6" };
  if (index >= 6 && index <= 10) return { gridColumn: "1", gridRow: `${6 - (index - 5)}` };
  if (index >= 11 && index <= 15) return { gridColumn: `${index - 10 + 1}`, gridRow: "1" };
  if (index >= 16 && index <= 19) return { gridColumn: "6", gridRow: `${index - 15 + 1}` };
  return {};
};

export default function Board({ tiles, players, currentPlayerId, onTileClick }: BoardProps) {
  return (
    <div className="relative w-full aspect-square max-w-[800px] mx-auto bg-surface2 rounded-xl border-4 border-surface shadow-2xl p-2 sm:p-4 overflow-hidden">
      <div className="grid grid-cols-6 grid-rows-6 gap-1 sm:gap-2 w-full h-full">
        <div className="col-start-2 col-span-4 row-start-2 row-span-4 flex flex-col items-center justify-center p-6 text-center opacity-30 pointer-events-none select-none">
          <h1 className="text-4xl sm:text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-br from-neon-cyan to-accent-rose tracking-tighter">
            ONE<br />POLY
          </h1>
          <div className="mt-4 text-neon-cyan animate-pulse">WAITING FOR ROLL...</div>
        </div>

        {tiles.map((tile) => {
          const style = getGridStyle(tile.id);
          const owner = tile.owner !== undefined && tile.owner !== null ? players.find((p) => p.id === tile.owner) : null;
          const playersHere = players.filter((p) => p.position === tile.id);

          return (
            <div
              key={tile.id}
              style={style}
              onClick={() => onTileClick(tile)}
              className="relative group cursor-pointer transition-all duration-200 bg-surface border border-border rounded-lg overflow-hidden hover:border-neon-cyan hover:shadow-neon hover:z-10 hover:scale-105 flex flex-col justify-between"
            >
              {tile.type === TileType.PROPERTY && tile.data && (
                <div className="h-1.5 sm:h-3 w-full mb-1 sm:mb-2 rounded-sm" style={{ backgroundColor: tile.data.groupColor }} />
              )}

              <div className="flex-1 flex flex-col items-center justify-center text-center p-0.5">
                {tile.type === TileType.CORNER ? (
                  <div className="text-text-secondary">
                    {tile.id === 0 && <span className="font-bold text-neon-cyan text-[10px] sm:text-xs">GO →</span>}
                    {tile.id === 5 && <Lock className="w-4 h-4 sm:w-6 sm:h-6" />}
                    {tile.id === 10 && <Car className="w-4 h-4 sm:w-6 sm:h-6" />}
                    {tile.id === 15 && <AlertOctagon className="w-4 h-4 sm:w-6 sm:h-6 text-accent-rose" />}
                  </div>
                ) : (
                  <>
                    <span className="text-[8px] sm:text-[10px] leading-tight font-medium text-text-secondary truncate w-full px-1">
                      {tile.name}
                    </span>
                    <span className="text-[8px] sm:text-xs text-text-muted mt-0.5">${tile.data?.price}</span>
                  </>
                )}
              </div>

              {owner && <div className="absolute inset-0 border-2 pointer-events-none rounded-lg opacity-50" style={{ borderColor: owner.color }} />}

              <div className="absolute bottom-1 right-1 flex -space-x-1 sm:-space-x-2">
                {playersHere.map((p) => (
                  <div
                    key={p.id}
                    className="w-3 h-3 sm:w-6 sm:h-6 rounded-full border border-white shadow-lg flex items-center justify-center text-[6px] sm:text-[10px] font-bold text-background z-10 transition-transform"
                    style={{ backgroundColor: p.color, transform: p.id === currentPlayerId ? "scale(1.2)" : "scale(1)" }}
                    title={p.name}
                  >
                    {p.name.charAt(0)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
