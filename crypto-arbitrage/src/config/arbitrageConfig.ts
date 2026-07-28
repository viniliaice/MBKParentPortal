export interface ExchangeConfig {
  id: string;
  name: string;
  /**
   * Default trading fee as a fraction.
   * e.g., 0.001 represents 0.1% per trade.
   * Adjust these values to plug in real fee structures later.
   */
  defaultFee: number;
  enabled: boolean;
}

export interface NormalizedTicker {
  exchange: string;
  symbol: string;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface ArbitrageConfig {
  /**
   * Currency pairs to monitor.
   * Format: COIN/QUOTE (e.g., BTC/USDT)
   */
  pairs: string[];
  
  /**
   * Exchanges to query for data.
   */
  exchanges: ExchangeConfig[];
  
  /**
   * Interval in milliseconds for polling endpoints.
   * Node.js service polls every 2-3 seconds as per requirements.
   */
  pollingIntervalMs: number;
  
  /**
   * Default browser alert threshold for net profit % (e.g., 1.0 = 1%)
   */
  defaultAlertThresholdPercent: number;
}

export const arbitrageConfig: ArbitrageConfig = {
  pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT'],
  exchanges: [
    {
      id: 'binance',
      name: 'Binance',
      defaultFee: 0.0010, // 0.10% maker/taker standard fee
      enabled: true,
    },
    {
      id: 'coinbase',
      name: 'Coinbase Exchange',
      defaultFee: 0.0040, // 0.40% maker/taker standard starter tier fee
      enabled: true,
    },
    {
      id: 'okx',
      name: 'OKX',
      defaultFee: 0.0010, // 0.10% standard spot trading fee
      enabled: true,
    },
    {
      id: 'bybit',
      name: 'Bybit',
      defaultFee: 0.0010, // 0.10% standard spot fee
      enabled: true,
    },
    {
      id: 'kucoin',
      name: 'KuCoin',
      defaultFee: 0.0010, // 0.10% standard class A spot fee
      enabled: true,
    },
    {
      id: 'bitget',
      name: 'Bitget',
      defaultFee: 0.0010, // 0.10% standard maker/taker spot fee
      enabled: true,
    },
    {
      id: 'upbit',
      name: 'Upbit',
      defaultFee: 0.0005, // 0.05% standard KRW/USDT spot fee
      enabled: true,
    },
  ],
  pollingIntervalMs: 2500, // Poll every 2.5 seconds
  defaultAlertThresholdPercent: 1.0, // Alert on >= 1% net profit opportunities
};
