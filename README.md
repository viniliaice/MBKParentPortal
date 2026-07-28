# Crypto Arbitrage Monitoring Dashboard

A high-performance real-time cryptocurrency arbitrage monitoring dashboard. It continuously tracks 5 major currency pairs across 7 leading cryptocurrency exchanges and evaluates fee-adjusted spread margins in real time, featuring interactive visualizations, customizable fee structures, and alert trigger mechanics.

## 🚀 Quick Start Setup

To download dependencies and boot both the backend polling service and the Next.js frontend concurrently, run:

```bash
# Install all dependencies (automatically triggers postinstall for dashboard)
npm install

# Run the real-time development environment (Frontend on Port 3000, Backend on Port 4000)
npm run dev
```

The app will immediately boot, and you can open **`http://localhost:3000`** in your browser to inspect the live dashboard!

---

## 📂 Repository Structure

The arbitrage dashboard is located inside the `crypto-arbitrage` folder, preserving the existing mobile project:

```
MBKParentPortal/
├── crypto-arbitrage/              # Primary Dashboard Directory
│   ├── src/
│   │   ├── config/
│   │   │   └── arbitrageConfig.ts # Simple Centralized Configuration File
│   │   ├── backend/
│   │   │   └── server.ts          # Express + WebSocket + Polling Service
│   │   └── app/
│   │       ├── layout.tsx         # Next.js Root Layout
│   │       └── page.tsx           # React Interactive Frontend Dashboard
│   ├── package.json               # Dashboard scripts & dependencies
│   └── tsconfig.json              # TypeScript compilation setup
├── package.json                   # Root package manager mapping dev scripts
```

---

## ⚙️ Centralized Configuration (`arbitrageConfig.ts`)

You can add or remove tracked currency pairs or exchange configurations dynamically without touching any of the polling or rendering core logic!

Located at: `crypto-arbitrage/src/config/arbitrageConfig.ts`

```typescript
export const arbitrageConfig: ArbitrageConfig = {
  // Add or remove pairs easily (standard COIN/USDT format)
  pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT'],
  
  // Configure platforms, enabling status, and default starting fees
  exchanges: [
    { id: 'binance', name: 'Binance', defaultFee: 0.0010, enabled: true },
    { id: 'coinbase', name: 'Coinbase Exchange', defaultFee: 0.0040, enabled: true },
    { id: 'okx', name: 'OKX', defaultFee: 0.0010, enabled: true },
    { id: 'bybit', name: 'Bybit', defaultFee: 0.0010, enabled: true },
    { id: 'kucoin', name: 'KuCoin', defaultFee: 0.0010, enabled: true },
    { id: 'bitget', name: 'Bitget', defaultFee: 0.0010, enabled: true },
    { id: 'upbit', name: 'Upbit', defaultFee: 0.0005, enabled: true },
  ],
  pollingIntervalMs: 2500, // Query public endpoints every 2.5 seconds
  defaultAlertThresholdPercent: 1.0, // Default threshold for alerts
};
```

---

## 💸 Where to Plug in Real Fee Structures

Currently, trading fee calculations use standard starting percentages (e.g. `0.10%` for Binance, `0.40%` for Coinbase). 
In real trading environments, fee tiers depend on your VIP level, monthly trade volumes, or whether you pay in native platform tokens (like BNB or KCS).

Here is how you can customize this:

1. **Static Pre-Sets (Simplest):** Update `defaultFee` within `crypto-arbitrage/src/config/arbitrageConfig.ts`.
2. **Interactive UI Adjustments (Fully Supported!):** Go to the **"Adjust Fees"** tab inside the web UI. You can type in any custom fee percentage (e.g. `0.075%`), click "Apply Fee", and the backend server will immediately update its fee multipliers, recalculate net margins, and broadcast updates to all connected browser tabs.
3. **Dynamic API Tiers (Production integration):**
   In the backend polling loop inside `crypto-arbitrage/src/backend/server.ts`, you can query private authenticated API endpoints of each exchange to retrieve your exact personal fee rates:
   - *Binance:* `GET /api/v3/tradeFee` (requires API keys and signatures).
   - *KuCoin:* `GET /api/v1/trade-fees`.
   - Then override `state.exchangesStatus[exchangeId].fee` with the retrieved value on startup.

---

## ⚡ Real-Time Arbitrage Calculation & Ranking Logic

### 1. The Spread Profit Formula
To compute the true fee-adjusted net spread, we simulate a standard transaction:
- **Buy** on Exchange A at its ask price ($P_{ask, A}$) and pay A's standard buy trade fee rate ($C_{buy}$).
- **Sell** on Exchange B at its bid price ($P_{bid, B}$) and pay B's standard sell trade fee rate ($C_{sell}$).

The mathematical formula used is:
$$\text{Net Profit \%} = \left( \frac{P_{bid, B} \times (1 - C_{sell})}{P_{ask, A} \times (1 + C_{buy})} - 1 \right) \times 100$$

### 2. Sorting & Ranking
The opportunities are compiled for all 5 pairs, identifying the single most profitable Exchange Buy $\rightarrow$ Exchange Sell pair for each. The resulting list is sorted **by Net Profit % descending**, meaning the overall most profitable coin to trade is always forced to the top of the grid.

---

## 🛡️ Robust Failures & Offline Fallback (High-Fidelity Mock Mode)

1. **Stale Exchange Isolation:** If a public exchange API times out, fails, or throws a rate limit error, the backend service logs the incident and marks that exchange as `online: false`. The rest of the dashboard **continues to run perfectly**, displaying the other 6 exchanges' pricing while notifying the user that the stale platform's data is offline.
2. **Egress Firewall & Geo-Blocking Bypass:** Some major exchanges (like Binance and OKX) block US IP addresses, and many sandboxed testing environments disable outbound HTTPS requests.
   - **How we handle this:** If the polling service detects that outgoing requests are failing, it **automatically falls back to a high-fidelity mock data generator**.
   - This generator simulates real, active, floating prices for all 5 coins, applying realistic price premiums (like Upbit's Kimchi Premium) and fluctuating spreads to test the dashboard, sorting, alerts, and custom fee adjustment interfaces flawlessly.
   - You can also manually toggle this mock mode on and off using the **"Mode"** button in the header!
