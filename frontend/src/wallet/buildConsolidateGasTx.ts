// /frontend/src/wallet/buildConsolidateGasTx.ts
import { Transaction } from "@mysten/sui/transactions";

export function buildConsolidateGasTx(otherCoinIds: string[]) {
  const tx = new Transaction();
  // Merge other coins INTO the gas coin
  tx.mergeCoins(
    tx.gas,
    otherCoinIds.map((id) => tx.object(id))
  );
  return tx;
}
