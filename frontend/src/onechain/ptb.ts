// /frontend/src/onechain/ptb.ts
import { Transaction } from "@mysten/sui/transactions";

const PKG = import.meta.env.VITE_PACKAGE_ID as string | undefined;
const MOD = (import.meta.env.VITE_GAME_MODULE as string | undefined) ?? "monopoly";
const FN_CREATE = (import.meta.env.VITE_CREATE_GAME_FN as string | undefined) ?? "create_game";
const FN_JOIN = (import.meta.env.VITE_JOIN_GAME_FN as string | undefined) ?? "join_game";

function requirePkg() {
  if (!PKG) throw new Error("VITE_PACKAGE_ID not set");
  return PKG;
}

export function buildCreateGameTx(gameId: bigint) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${requirePkg()}::${MOD}::${FN_CREATE}`,
    arguments: [tx.pure.u64(gameId)],
  });
  return tx;
}

export function buildJoinGameTx(gameObjectId: string, piece: number) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${requirePkg()}::${MOD}::${FN_JOIN}`,
    arguments: [tx.object(gameObjectId), tx.pure.u8(piece)],
  });
  return tx;
}

export function buildStartGameTx(gameObjectId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${requirePkg()}::${MOD}::start_game`,
    arguments: [tx.object(gameObjectId)],
  });
  return tx;
}

export function buildRollDiceTx(gameObjectId: string, d1: number, d2: number) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${requirePkg()}::${MOD}::roll_dice`,
    arguments: [tx.object(gameObjectId), tx.pure.u8(d1), tx.pure.u8(d2)],
  });
  return tx;
}

export function buildNextTurnTx(gameObjectId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${requirePkg()}::${MOD}::next_turn`,
    arguments: [tx.object(gameObjectId)],
  });
  return tx;
}

export function buildBuyPropertyTx(gameObjectId: string, pos: number) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${requirePkg()}::${MOD}::buy_property`,
    arguments: [tx.object(gameObjectId), tx.pure.u8(pos)],
  });
  return tx;
}

export function buildBuyHouseTx(gameObjectId: string, pos: number) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${requirePkg()}::${MOD}::buy_house`,
    arguments: [tx.object(gameObjectId), tx.pure.u8(pos)],
  });
  return tx;
}

export function buildSellHouseTx(gameObjectId: string, pos: number) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${requirePkg()}::${MOD}::sell_house`,
    arguments: [tx.object(gameObjectId), tx.pure.u8(pos)],
  });
  return tx;
}

async function rpcCall(method: string, params: any[]) {
  const url = import.meta.env.VITE_ONECHAIN_RPC as string;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method} failed: ${JSON.stringify(json.error)}`);
  return json.result;
}

export async function getTxByDigest(digest: string) {
  const options = { showEffects: true, showObjectChanges: true, showInput: true, showEvents: true };
  for (const method of ["sui_getTransactionBlock", "one_getTransactionBlock"]) {
    try {
      return await rpcCall(method, [digest, options]);
    } catch {
      // try next
    }
  }
  throw new Error("No getTransactionBlock method succeeded");
}

export function extractCreatedObjectId(resp: any, typeName?: string): string | null {
  const changes = resp?.objectChanges ?? resp?.effects?.objectChanges ?? [];
  if (Array.isArray(changes)) {
    for (const ch of changes) {
      const createdId = ch?.objectId ?? ch?.reference?.objectId ?? ch?.id;
      const t = String(ch?.objectType ?? ch?.type ?? "");
      if (!createdId) continue;
      if (!typeName) return createdId;
      if (t.includes(`::${typeName}`) || t.endsWith(typeName)) return createdId;
    }
  }

  const created2 = resp?.effects?.created;
  if (Array.isArray(created2)) {
    for (const c of created2) {
      const createdId = c?.reference?.objectId ?? c?.objectId;
      if (!createdId) continue;
      if (!typeName) return createdId;
      const t = String(c?.owner?.Shared?.initialSharedVersion ?? c?.owner ?? "");
      if (t.includes(`::${typeName}`) || t.endsWith(typeName)) return createdId;
    }
  }

  return null;
}
