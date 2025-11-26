// /frontend/src/onechain/client.ts
import { SuiClient } from "@onelabs/sui/client";

const rpcUrl = import.meta.env.VITE_ONECHAIN_RPC;

if (!rpcUrl) {
  throw new Error("VITE_ONECHAIN_RPC is not set");
}

let client: SuiClient | null = null;

export function getClient() {
  if (client) return client;
  client = new SuiClient({ url: rpcUrl });
  return client;
}

export async function fetchObject<T = unknown>(objectId: string) {
  const c = getClient();
  const resp = await c.getObject({ id: objectId, options: { showContent: true } });
  return resp.data?.content as T | undefined;
}
