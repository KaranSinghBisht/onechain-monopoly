// /frontend/src/lib/devlog.ts
export const devlog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

export const deverr = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.error(...args);
};
