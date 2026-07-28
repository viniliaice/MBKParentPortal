# Crypto Arbitrage Dashboard App

This is the Next.js frontend and Node.js TypeScript backend service directory.

## Getting Started

To run the local development setup:
1. Make sure you have Node.js 18+ or 22+ installed.
2. From this folder:
   ```bash
   npm install
   npm run dev
   ```
   Or from the workspace root:
   ```bash
   npm install
   npm run dev
   ```

## Folder Structure

- `src/config/arbitrageConfig.ts`: Simple configuration file to add/remove coins or platforms.
- `src/backend/server.ts`: long-running polling service, WebSocket broadcast, and Express server.
- `src/app/page.tsx`: Tailwind-styled interactive real-time dashboard UI.
