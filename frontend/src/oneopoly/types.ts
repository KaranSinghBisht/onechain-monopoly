// /frontend/src/oneopoly/types.ts
export type PlayerId = number;

export interface Player {
  id: PlayerId;
  address: string;
  name: string;
  money: number;
  position: number;
  isActive: boolean;
  color: string;
}

export const TileType = {
  PROPERTY: "PROPERTY",
  CORNER: "CORNER",
  CHANCE: "CHANCE",
} as const;

export type TileType = (typeof TileType)[keyof typeof TileType];

export interface PropertyData {
  price: number;
  rent: number;
  groupColor: string;
}

export interface Tile {
  id: number;
  name: string;
  type: TileType;
  data?: PropertyData;
  owner?: PlayerId | null;
  houses?: number;
}

export interface GameEvent {
  id: string;
  text: string;
  type: "move" | "buy" | "rent" | "info" | "error";
  timestamp: number;
}

export interface GameState {
  status: "lobby" | "playing" | "ended";
  turn: PlayerId;
  hasRolled: boolean;
  players: Player[];
  board: Tile[];
  dice: [number, number];
  history: GameEvent[];
  winner?: PlayerId;
}

export interface ChainGameFields {
  started?: boolean;
  current_player?: number;
  has_rolled?: boolean;
  player_addrs?: string[];
  positions?: number[];
  money?: number[];
  active?: boolean[];
  props?: Array<Record<string, any>>;
}
