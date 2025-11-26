// /frontend/src/oneopoly/helpers.ts
export function shortAddr(addr?: string) {
  if (!addr) return "";
  const a = String(addr);
  if (a.length <= 16) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
