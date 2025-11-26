# OnePoly (OneChain Monopoly) — Demo DApp

A minimal on-chain Monopoly-style experience on OneChain:
- Create a shared on-chain Game object (lobby)
- Share an invite link with a friend
- Roll dice, buy properties, build/sell houses, and pay rent (Move entry fun'ctions)

## Prerequisites
- Node.js 18+ (20+ recommended)
- OneWallet (Wallet Standard compatible)
- OneChain RPC endpoint + deployed Move package ID

## Setup (Local)
1) Install deps
```bash
cd frontend
npm install
```
2) Create `frontend/.env`:
```bash
VITE_ONECHAIN_RPC=YOUR_RPC_URL
VITE_PACKAGE_ID=YOUR_PACKAGE_ID
# Optional:
# VITE_GAME_MODULE=oneopoly
# VITE_WALLET_CHAIN=YOUR_CHAIN_ID
```
3) Run dev server
```bash
npm run dev
```

## Deploy Notes
- After publishing a new Move package, update `VITE_PACKAGE_ID` (and `VITE_GAME_MODULE` if it changes), redeploy/restart, and create a new lobby.
- Board size is 20 tiles; only tiles with on-chain price > 0 are purchasable (see `contracts/oneopoly/sources/monopoly.move`).

## Gameplay Flow
1. Connect wallet and click **Create New Game** to create a lobby (shared Game object).
2. Copy the invite link and open it in a second wallet/browser.
3. Host starts the game once two players join.
4. Each turn: roll dice → buy property if you land on it (and it’s purchasable) → build/sell houses when allowed → end turn.

## Repo Layout
- `frontend/` — React/Vite DApp
- `src/onechain` — RPC/PTB helpers
- `src/oneopoly` — UI + game logic
- `src/wallet` — wallet plumbing
- `contracts/oneopoly` — Move modules
