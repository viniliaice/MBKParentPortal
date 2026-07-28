import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { arbitrageConfig, ExchangeConfig, NormalizedTicker } from '../config/arbitrageConfig';

const app = express();
app.use(cors());
app.use(express.json());

const HTTP_PORT = process.env.PORT || 4000;
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// In-memory State
interface ExchangeStatus {
  id: string;
  name: string;
  online: boolean;
  lastPolled: number | null;
  error?: string;
  fee: number;
}

interface State {
  tickers: {
    [pair: string]: {
      [exchangeId: string]: NormalizedTicker;
    };
  };
  exchangesStatus: {
    [exchangeId: string]: ExchangeStatus;
  };
  useMockFallback: boolean; // Automatic or manual toggle for realistic mock prices
  mockIntervalId: NodeJS.Timeout | null;
}

const state: State = {
  tickers: {},
  exchangesStatus: {},
  useMockFallback: false,
  mockIntervalId: null,
};

// Initialize exchanges status and tickers structure
arbitrageConfig.exchanges.forEach((ex) => {
  state.exchangesStatus[ex.id] = {
    id: ex.id,
    name: ex.name,
    online: false,
    lastPolled: null,
    fee: ex.defaultFee,
  };
});

arbitrageConfig.pairs.forEach((pair) => {
  state.tickers[pair] = {};
});

// Mock base prices for fallback and fluctuations
const MOCK_BASE_PRICES: { [pair: string]: number } = {
  'BTC/USDT': 64250.0,
  'ETH/USDT': 3450.0,
  'SOL/USDT': 178.50,
  'XRP/USDT': 0.5850,
  'DOGE/USDT': 0.1250,
};

// Realistic mock offsets per exchange to simulate premium and spreads
// e.g. Upbit has "Kimchi premium" (+2.5%), KuCoin and OKX have slight discounts, etc.
const MOCK_OFFSETS: { [exchangeId: string]: number } = {
  binance: 1.0000,
  coinbase: 1.0018, // selling premium
  okx: 0.9991,      // buying discount
  bybit: 1.0005,
  kucoin: 0.9982,   // buying discount
  bitget: 1.0012,
  upbit: 1.0150,    // classic Upbit Kimchi Premium
};

// Function to generate and fluctuate mock tickers
function generateMockTickers() {
  const now = Date.now();
  
  arbitrageConfig.pairs.forEach((pair) => {
    const base = MOCK_BASE_PRICES[pair];
    // Fluctuate the base price slightly (random walk of up to 0.1%)
    const wave = 1 + (Math.random() - 0.5) * 0.002;
    MOCK_BASE_PRICES[pair] = base * wave;
    
    arbitrageConfig.exchanges.forEach((ex) => {
      if (!ex.enabled) return;
      
      const exchangeBase = MOCK_BASE_PRICES[pair] * (MOCK_OFFSETS[ex.id] || 1.0);
      // Small random spread between bid and ask (e.g. 0.02% to 0.1% spread)
      const halfSpread = exchangeBase * (0.0002 + Math.random() * 0.0008) / 2;
      
      state.tickers[pair][ex.id] = {
        exchange: ex.id,
        symbol: pair,
        bid: +(exchangeBase - halfSpread).toFixed(ex.id === 'upbit' ? 0 : 5),
        ask: +(exchangeBase + halfSpread).toFixed(ex.id === 'upbit' ? 0 : 5),
        timestamp: now,
      };
      
      state.exchangesStatus[ex.id].online = true;
      state.exchangesStatus[ex.id].lastPolled = now;
      state.exchangesStatus[ex.id].error = undefined;
    });
  });
}

// REST API Helper: fetch with abort timeout
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Exchange Fetchers mapping
async function fetchBinance(): Promise<NormalizedTicker[]> {
  const endpoints = [
    'https://api.binance.com/api/v3/ticker/bookTicker',
    'https://api1.binance.com/api/v3/ticker/bookTicker',
    'https://api2.binance.com/api/v3/ticker/bookTicker',
    'https://api3.binance.com/api/v3/ticker/bookTicker'
  ];

  let lastError: any = null;
  for (const url of endpoints) {
    try {
      const data = await fetchWithTimeout(url, {}, 2500);
      const tickers: NormalizedTicker[] = [];
      const symbolMap: { [key: string]: string } = {
        'BTCUSDT': 'BTC/USDT',
        'ETHUSDT': 'ETH/USDT',
        'SOLUSDT': 'SOL/USDT',
        'XRPUSDT': 'XRP/USDT',
        'DOGEUSDT': 'DOGE/USDT'
      };
      
      if (Array.isArray(data)) {
        data.forEach((item) => {
          const standardPair = symbolMap[item.symbol];
          if (standardPair) {
            tickers.push({
              exchange: 'binance',
              symbol: standardPair,
              bid: parseFloat(item.bidPrice),
              ask: parseFloat(item.askPrice),
              timestamp: Date.now()
            });
          }
        });
      }
      return tickers;
    } catch (err: any) {
      lastError = err;
      // Silent warning, we try fallback URLs
    }
  }
  throw lastError || new Error('All Binance endpoints failed');
}

async function fetchCoinbase(pair: string): Promise<NormalizedTicker> {
  const cbPair = pair.replace('/', '-'); // BTC/USDT -> BTC-USDT
  const data = await fetchWithTimeout(
    `https://api.exchange.coinbase.com/products/${cbPair}/ticker`,
    {
      headers: { 'User-Agent': 'CryptoArbitrageDashboard/1.0.0' }
    },
    2500
  );
  return {
    exchange: 'coinbase',
    symbol: pair,
    bid: parseFloat(data.bid),
    ask: parseFloat(data.ask),
    timestamp: new Date(data.time).getTime()
  };
}

async function fetchOKX(pair: string): Promise<NormalizedTicker> {
  const okxPair = pair.replace('/', '-');
  const data = await fetchWithTimeout(`https://www.okx.com/api/v5/market/ticker?instId=${okxPair}`, {}, 2500);
  if (data && data.code === '0' && data.data && data.data[0]) {
    const item = data.data[0];
    return {
      exchange: 'okx',
      symbol: pair,
      bid: parseFloat(item.bidPx),
      ask: parseFloat(item.askPx),
      timestamp: parseInt(item.ts)
    };
  }
  throw new Error(`OKX invalid response for ${pair}`);
}

async function fetchBybit(): Promise<NormalizedTicker[]> {
  const endpoints = [
    'https://api.bybit.com/v5/market/tickers?category=spot',
    'https://api.bytick.com/v5/market/tickers?category=spot'
  ];

  let lastError: any = null;
  for (const url of endpoints) {
    try {
      const data = await fetchWithTimeout(url, {}, 2500);
      const tickers: NormalizedTicker[] = [];
      const symbolMap: { [key: string]: string } = {
        'BTCUSDT': 'BTC/USDT',
        'ETHUSDT': 'ETH/USDT',
        'SOLUSDT': 'SOL/USDT',
        'XRPUSDT': 'XRP/USDT',
        'DOGEUSDT': 'DOGE/USDT'
      };
      
      if (data && data.retCode === 0 && data.result && Array.isArray(data.result.list)) {
        const serverTime = data.time ? parseInt(data.time) : Date.now();
        data.result.list.forEach((item: any) => {
          const standardPair = symbolMap[item.symbol];
          if (standardPair) {
            tickers.push({
              exchange: 'bybit',
              symbol: standardPair,
              bid: parseFloat(item.bid1Price),
              ask: parseFloat(item.ask1Price),
              timestamp: serverTime
            });
          }
        });
      }
      return tickers;
    } catch (err: any) {
      lastError = err;
      // try next fallback
    }
  }
  throw lastError || new Error('All Bybit endpoints failed');
}

async function fetchKuCoin(pair: string): Promise<NormalizedTicker> {
  const kcPair = pair.replace('/', '-');
  const data = await fetchWithTimeout(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${kcPair}`, {}, 2500);
  if (data && data.code === '200000' && data.data) {
    const item = data.data;
    return {
      exchange: 'kucoin',
      symbol: pair,
      bid: parseFloat(item.bestBid),
      ask: parseFloat(item.bestAsk),
      timestamp: item.time
    };
  }
  throw new Error(`KuCoin invalid response for ${pair}`);
}

async function fetchBitget(): Promise<NormalizedTicker[]> {
  const data = await fetchWithTimeout('https://api.bitget.com/api/v2/spot/market/tickers', {}, 2500);
  const tickers: NormalizedTicker[] = [];
  const symbolMap: { [key: string]: string } = {
    'BTCUSDT': 'BTC/USDT',
    'ETHUSDT': 'ETH/USDT',
    'SOLUSDT': 'SOL/USDT',
    'XRPUSDT': 'XRP/USDT',
    'DOGEUSDT': 'DOGE/USDT'
  };
  
  if (data && data.code === '00000' && Array.isArray(data.data)) {
    data.data.forEach((item: any) => {
      const standardPair = symbolMap[item.symbol];
      if (standardPair) {
        tickers.push({
          exchange: 'bitget',
          symbol: standardPair,
          bid: parseFloat(item.bidPr),
          ask: parseFloat(item.askPr),
          timestamp: parseInt(item.ts) || Date.now()
        });
      }
    });
  }
  return tickers;
}

async function fetchUpbit(): Promise<NormalizedTicker[]> {
  const markets = 'USDT-BTC,USDT-ETH,USDT-SOL,USDT-XRP,USDT-DOGE';
  const data = await fetchWithTimeout(`https://api.upbit.com/v1/orderbook?markets=${markets}`, {}, 2500);
  const tickers: NormalizedTicker[] = [];
  const marketMap: { [key: string]: string } = {
    'USDT-BTC': 'BTC/USDT',
    'USDT-ETH': 'ETH/USDT',
    'USDT-SOL': 'SOL/USDT',
    'USDT-XRP': 'XRP/USDT',
    'USDT-DOGE': 'DOGE/USDT'
  };
  
  if (Array.isArray(data)) {
    data.forEach((item: any) => {
      const standardPair = marketMap[item.market];
      if (standardPair && item.orderbook_units && item.orderbook_units[0]) {
        const bestUnit = item.orderbook_units[0];
        tickers.push({
          exchange: 'upbit',
          symbol: standardPair,
          bid: parseFloat(bestUnit.bid_price),
          ask: parseFloat(bestUnit.ask_price),
          timestamp: item.timestamp
        });
      }
    });
  }
  return tickers;
}

// Polling function for a single exchange with retry / backoff logic
async function pollExchangeWithRetry(exId: string, retryCount = 2, delayMs = 500): Promise<void> {
  const exConfig = arbitrageConfig.exchanges.find((ex) => ex.id === exId);
  if (!exConfig || !exConfig.enabled) return;

  for (let i = 0; i <= retryCount; i++) {
    try {
      if (exId === 'binance') {
        const binanceTickers = await fetchBinance();
        binanceTickers.forEach((t) => {
          state.tickers[t.symbol][exId] = t;
        });
      } else if (exId === 'bybit') {
        const bybitTickers = await fetchBybit();
        bybitTickers.forEach((t) => {
          state.tickers[t.symbol][exId] = t;
        });
      } else if (exId === 'bitget') {
        const bitgetTickers = await fetchBitget();
        bitgetTickers.forEach((t) => {
          state.tickers[t.symbol][exId] = t;
        });
      } else if (exId === 'upbit') {
        const upbitTickers = await fetchUpbit();
        upbitTickers.forEach((t) => {
          state.tickers[t.symbol][exId] = t;
        });
      } else {
        // Individual endpoints (Coinbase, OKX, KuCoin)
        // We run these queries in parallel with a slight delay if needed
        const fetchPromises = arbitrageConfig.pairs.map(async (pair) => {
          try {
            let t: NormalizedTicker;
            if (exId === 'coinbase') {
              t = await fetchCoinbase(pair);
            } else if (exId === 'okx') {
              t = await fetchOKX(pair);
            } else if (exId === 'kucoin') {
              t = await fetchKuCoin(pair);
            } else {
              throw new Error(`Unknown exchange: ${exId}`);
            }
            state.tickers[pair][exId] = t;
          } catch (err) {
            // Log pair-specific fetch failure
            // console.warn(`Failed to fetch ${pair} on ${exId}`);
          }
        });
        await Promise.all(fetchPromises);
      }

      // If we got here, poll succeeded!
      state.exchangesStatus[exId].online = true;
      state.exchangesStatus[exId].lastPolled = Date.now();
      state.exchangesStatus[exId].error = undefined;
      return; // success, break out of retry loop

    } catch (error: any) {
      console.error(`Error polling ${exId} (attempt ${i + 1}/${retryCount + 1}):`, error.message);
      if (i < retryCount) {
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
      } else {
        // Mark as offline/stale on final failure
        state.exchangesStatus[exId].online = false;
        state.exchangesStatus[exId].error = error.message;
      }
    }
  }
}

// Master polling function that iterates through all exchanges
async function pollAllExchanges(): Promise<void> {
  const activeExchanges = arbitrageConfig.exchanges.filter((ex) => ex.enabled);
  
  // Poll all exchanges concurrently
  await Promise.all(
    activeExchanges.map((ex) => pollExchangeWithRetry(ex.id))
  );

  // Check if ALL enabled exchanges are failing / offline.
  // If so, automatically enable mock fallback so the dashboard works perfectly in sandboxes/offline!
  const onlineCount = activeExchanges.filter((ex) => state.exchangesStatus[ex.id].online).length;
  if (onlineCount === 0 && !state.useMockFallback) {
    console.warn('⚠️ All real exchanges failed or are offline. Automatically falling back to realistic live mock data!');
    state.useMockFallback = true;
  }
}

// Interval loop manager
let pollIntervalId: NodeJS.Timeout | null = null;

function startPolling() {
  if (pollIntervalId) clearInterval(pollIntervalId);
  if (state.mockIntervalId) clearInterval(state.mockIntervalId);

  console.log(`Starting monitoring backend. Polling interval: ${arbitrageConfig.pollingIntervalMs}ms`);

  const executionCycle = async () => {
    if (state.useMockFallback) {
      generateMockTickers();
      broadcastUpdate();
    } else {
      await pollAllExchanges();
      broadcastUpdate();
    }
  };

  // Run immediately then schedule
  executionCycle();
  pollIntervalId = setInterval(executionCycle, arbitrageConfig.pollingIntervalMs);
}

// Arbitrage Calculation Logic
export interface ArbitrageOpportunity {
  pair: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  rawSpreadPercent: number;
  feeAdjustedProfitPercent: number;
  lastUpdated: number;
}

export function calculateOpportunities(): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  arbitrageConfig.pairs.forEach((pair) => {
    const pairTickers = state.tickers[pair] || {};
    let bestOpportunity: ArbitrageOpportunity | null = null;

    // Compare all exchanges pair-wise
    arbitrageConfig.exchanges.forEach((buyEx) => {
      if (!buyEx.enabled) return;
      const buyTicker = pairTickers[buyEx.id];
      if (!buyTicker || buyTicker.ask <= 0) return;

      arbitrageConfig.exchanges.forEach((sellEx) => {
        if (!sellEx.enabled || buyEx.id === sellEx.id) return;
        const sellTicker = pairTickers[sellEx.id];
        if (!sellTicker || sellTicker.bid <= 0) return;

        // Skip if either ticker data is very old (stale > 15 seconds)
        const now = Date.now();
        if (now - buyTicker.timestamp > 15000 || now - sellTicker.timestamp > 15000) {
          return;
        }

        const askPrice = buyTicker.ask;
        const bidPrice = sellTicker.bid;

        // Trading Fees
        // These can be adjusted per exchange in arbitrageConfig.ts or inside state
        const buyFeeRate = state.exchangesStatus[buyEx.id].fee;
        const sellFeeRate = state.exchangesStatus[sellEx.id].fee;

        // Raw price spread %
        const rawSpreadPercent = ((bidPrice - askPrice) / askPrice) * 100;

        // Fee adjusted net profit %
        // buying cost: askPrice * (1 + buyFeeRate)
        // selling revenue: bidPrice * (1 - sellFeeRate)
        const feeAdjustedProfitPercent = (
          (bidPrice * (1 - sellFeeRate)) / (askPrice * (1 + buyFeeRate)) - 1
        ) * 100;

        const opp: ArbitrageOpportunity = {
          pair,
          buyExchange: buyEx.id,
          sellExchange: sellEx.id,
          buyPrice: askPrice,
          sellPrice: bidPrice,
          rawSpreadPercent: +rawSpreadPercent.toFixed(4),
          feeAdjustedProfitPercent: +feeAdjustedProfitPercent.toFixed(4),
          lastUpdated: Math.min(buyTicker.timestamp, sellTicker.timestamp),
        };

        if (!bestOpportunity || opp.feeAdjustedProfitPercent > bestOpportunity.feeAdjustedProfitPercent) {
          bestOpportunity = opp;
        }
      });
    });

    if (bestOpportunity) {
      opportunities.push(bestOpportunity);
    }
  });

  // Sort opportunities by net profit % in descending order as per logic requirements
  return opportunities.sort((a, b) => b.feeAdjustedProfitPercent - a.feeAdjustedProfitPercent);
}

// WebSocket broadcast
function broadcastUpdate() {
  const opportunities = calculateOpportunities();
  const payload = JSON.stringify({
    type: 'UPDATE',
    data: {
      tickers: state.tickers,
      exchangesStatus: state.exchangesStatus,
      opportunities,
      useMockFallback: state.useMockFallback,
    },
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// REST API Endpoints
app.get('/api/state', (req, res) => {
  res.json({
    tickers: state.tickers,
    exchangesStatus: state.exchangesStatus,
    useMockFallback: state.useMockFallback,
  });
});

app.get('/api/opportunities', (req, res) => {
  res.json(calculateOpportunities());
});

app.get('/api/config', (req, res) => {
  res.json({
    pairs: arbitrageConfig.pairs,
    exchanges: arbitrageConfig.exchanges,
    pollingIntervalMs: arbitrageConfig.pollingIntervalMs,
    defaultAlertThresholdPercent: arbitrageConfig.defaultAlertThresholdPercent,
  });
});

app.post('/api/config/toggle-mock', (req, res) => {
  state.useMockFallback = !state.useMockFallback;
  console.log(`Fallback mock state toggled to: ${state.useMockFallback}`);
  // Run polling interval refresh to quickly switch
  startPolling();
  res.json({ success: true, useMockFallback: state.useMockFallback });
});

app.post('/api/config/update-fee', (req, res) => {
  const { exchangeId, fee } = req.body;
  if (state.exchangesStatus[exchangeId] !== undefined && typeof fee === 'number') {
    state.exchangesStatus[exchangeId].fee = fee;
    console.log(`Updated fee for ${exchangeId} to ${fee * 100}%`);
    broadcastUpdate();
    return res.json({ success: true, exchangeId, fee });
  }
  res.status(400).json({ success: false, error: 'Invalid exchange or fee parameter' });
});

// WebSocket Connection handler
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');
  
  // Send immediate update upon connection
  const opportunities = calculateOpportunities();
  ws.send(
    JSON.stringify({
      type: 'INIT',
      data: {
        tickers: state.tickers,
        exchangesStatus: state.exchangesStatus,
        opportunities,
        useMockFallback: state.useMockFallback,
      },
    })
  );

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Start service
httpServer.listen(HTTP_PORT, () => {
  console.log(`Backend server listening on HTTP port ${HTTP_PORT}`);
  startPolling();
});

// Clean shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  if (pollIntervalId) clearInterval(pollIntervalId);
  wss.close();
  httpServer.close();
});
