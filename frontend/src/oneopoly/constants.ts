// /frontend/src/oneopoly/constants.ts
import { TileType } from "./types";
import type { Player, Tile } from "./types";

export const COLORS = {
  background: "#070A12",
  surface: "#0B1220",
  surface2: "#0F1A2E",
  neonCyan: "#22D3EE",
  neonDeep: "#0891B2",
  gold: "#F5C542",
  green: "#22C55E",
  amber: "#F59E0B",
  rose: "#FB7185",
  text: "#E5E7EB",
};

// Simplified 20-tile board (6x6 perimeter)
export const INITIAL_BOARD: Tile[] = [
  { id: 0, name: "GO", type: TileType.CORNER },
  { id: 1, name: "One Street", type: TileType.PROPERTY, data: { price: 60, rent: 2, groupColor: "#22D3EE" } },
  { id: 2, name: "Validator Way", type: TileType.PROPERTY, data: { price: 60, rent: 4, groupColor: "#22D3EE" } },
  { id: 3, name: "Bridge Blvd", type: TileType.PROPERTY, data: { price: 80, rent: 6, groupColor: "#0891B2" } },
  { id: 4, name: "Rollup Row", type: TileType.PROPERTY, data: { price: 100, rent: 8, groupColor: "#0891B2" } },
  { id: 5, name: "JAIL", type: TileType.CORNER },
  { id: 6, name: "Sequencer Sq", type: TileType.PROPERTY, data: { price: 140, rent: 10, groupColor: "#F5C542" } },
  { id: 7, name: "Shard Street", type: TileType.PROPERTY, data: { price: 140, rent: 10, groupColor: "#F5C542" } },
  { id: 8, name: "Orbit Oval", type: TileType.PROPERTY, data: { price: 160, rent: 12, groupColor: "#F5C542" } },
  { id: 9, name: "Module Mall", type: TileType.PROPERTY, data: { price: 180, rent: 14, groupColor: "#F59E0B" } },
  { id: 10, name: "FREE PARKING", type: TileType.CORNER },
  { id: 11, name: "Consensus Ct", type: TileType.PROPERTY, data: { price: 220, rent: 18, groupColor: "#34D399" } },
  { id: 12, name: "Slot Street", type: TileType.PROPERTY, data: { price: 220, rent: 18, groupColor: "#34D399" } },
  { id: 13, name: "Auction Ave", type: TileType.PROPERTY, data: { price: 240, rent: 20, groupColor: "#34D399" } },
  { id: 14, name: "Finality Fork", type: TileType.PROPERTY, data: { price: 260, rent: 22, groupColor: "#FB7185" } },
  { id: 15, name: "GO TO JAIL", type: TileType.CORNER },
  { id: 16, name: "Gas Garden", type: TileType.PROPERTY, data: { price: 300, rent: 26, groupColor: "#818CF8" } },
  { id: 17, name: "MEV Mile", type: TileType.PROPERTY, data: { price: 300, rent: 26, groupColor: "#818CF8" } },
  { id: 18, name: "L2 Loop", type: TileType.PROPERTY, data: { price: 320, rent: 28, groupColor: "#22C55E" } },
  { id: 19, name: "Validator Vault", type: TileType.PROPERTY, data: { price: 350, rent: 35, groupColor: "#22C55E" } },
];

export const INITIAL_PLAYERS: Player[] = [
  { id: 0, address: "0xPLAYER0", name: "Player 0", money: 1500, position: 0, isActive: true, color: "#22D3EE" },
  { id: 1, address: "0xPLAYER1", name: "Player 1", money: 1500, position: 0, isActive: true, color: "#FB7185" },
];
