'use client';

import React, { useEffect, useState, useRef } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  Settings, 
  RefreshCw, 
  Bell, 
  CheckCircle, 
  XCircle, 
  Percent, 
  Cpu, 
  ShieldAlert, 
  HelpCircle,
  Database,
  Volume2
} from 'lucide-react';

interface NormalizedTicker {
  exchange: string;
  symbol: string;
  bid: number;
  ask: number;
  timestamp: number;
}

interface ExchangeStatus {
  id: string;
  name: string;
  online: boolean;
  lastPolled: number | null;
  error?: string;
  fee: number;
}

interface ArbitrageOpportunity {
  pair: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  rawSpreadPercent: number;
  feeAdjustedProfitPercent: number;
  lastUpdated: number;
}

interface UpdateMessage {
  type: string;
  data: {
    tickers: {
      [pair: string]: {
        [exchangeId: string]: NormalizedTicker;
      };
    };
    exchangesStatus: {
      [exchangeId: string]: ExchangeStatus;
    };
    opportunities: ArbitrageOpportunity[];
    useMockFallback: boolean;
  };
}

export default function Home() {
  // Real-time state
  const [tickers, setTickers] = useState<{ [pair: string]: { [exId: string]: NormalizedTicker } }>({});
  const [exchangesStatus, setExchangesStatus] = useState<{ [exId: string]: ExchangeStatus }>({});
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [useMockFallback, setUseMockFallback] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  
  // Custom alert settings
  const [alertThreshold, setAlertThreshold] = useState(1.0); // Default to 1%
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotificationsGranted, setBrowserNotificationsGranted] = useState(false);
  
  // Custom fee adjustments UI
  const [selectedExchangeForFee, setSelectedExchangeForFee] = useState<string>('');
  const [customFeeValue, setCustomFeeValue] = useState<string>('');
  
  // UI Tabs / Panels
  const [activeTab, setActiveTab] = useState<'arbitrage' | 'matrix' | 'fees'>('arbitrage');
  const [toasts, setToasts] = useState<{ id: string; title: string; body: string; type: 'success' | 'alert' | 'info' }[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const lastAlertedTimes = useRef<{ [pair: string]: number }>({});

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.permission;
      if (permission === 'default') {
        const result = await Notification.requestPermission();
        setBrowserNotificationsGranted(result === 'granted');
        addToast('Notifications', result === 'granted' ? 'Browser notifications enabled!' : 'Browser notifications denied.', 'info');
      } else {
        setBrowserNotificationsGranted(permission === 'granted');
      }
    }
  };

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserNotificationsGranted(Notification.permission === 'granted');
    }
  }, []);

  // Toast notifier helper
  const addToast = React.useCallback((title: string, body: string, type: 'success' | 'alert' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, body, type }]);
    
    // Play alert audio if enabled
    if (type === 'alert' && soundEnabled) {
      playAlertSound();
    }

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, [soundEnabled]);

  // Subtle clean notification sound using Web Audio API
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);  // A5 note
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(293.66, audioCtx.currentTime); // D4 note
      osc2.frequency.setValueAtTime(440, audioCtx.currentTime + 0.15);  // A4 note
      
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      
      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 0.4);
      osc2.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.error('Failed to play sound:', e);
    }
  };

  // Connect to backend WebSocket
  useEffect(() => {
    const connectWS = () => {
      // Create WebSocket targeting server (typically port 4000)
      const socketUrl = `ws://${window.location.hostname}:4000`;
      console.log(`Connecting to WebSocket at ${socketUrl}...`);
      const ws = new WebSocket(socketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: UpdateMessage = JSON.parse(event.data);
          if (message.type === 'INIT' || message.type === 'UPDATE') {
            setTickers(message.data.tickers);
            setExchangesStatus(message.data.exchangesStatus);
            setOpportunities(message.data.opportunities);
            setUseMockFallback(message.data.useMockFallback);
            
            // Evaluate for Alerts
            if (alertsEnabled) {
              message.data.opportunities.forEach((opp) => {
                if (opp.feeAdjustedProfitPercent >= alertThreshold) {
                  const now = Date.now();
                  const lastAlerted = lastAlertedTimes.current[opp.pair] || 0;
                  
                  // Rate limit alerts to once every 30 seconds per coin to prevent spamming
                  if (now - lastAlerted > 30000) {
                    lastAlertedTimes.current[opp.pair] = now;
                    
                    const title = `🚨 Arbitrage Opportunity: ${opp.pair}!`;
                    const body = `Net Profit: ${opp.feeAdjustedProfitPercent.toFixed(2)}% | Buy: ${opp.buyExchange.toUpperCase()} (${opp.buyPrice}) -> Sell: ${opp.sellExchange.toUpperCase()} (${opp.sellPrice})`;
                    
                    // Trigger in-app toast
                    addToast(title, body, 'alert');
                    
                    // Trigger browser notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                      new Notification(title, { body });
                    }
                  }
                }
              });
            }
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected. Retrying in 3 seconds...');
        setWsConnected(false);
        setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error encountered:', err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [alertThreshold, alertsEnabled, soundEnabled, addToast]);

  // Handle Toggling Mock vs Live mode via API
  const handleToggleMock = async () => {
    try {
      const response = await fetch(`http://${window.location.hostname}:4000/api/config/toggle-mock`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        setUseMockFallback(data.useMockFallback);
        addToast(
          'System Mode Switched',
          data.useMockFallback 
            ? 'Now running on high-fidelity live mock simulation mode!' 
            : 'Now querying real exchange market endpoints!',
          'success'
        );
      }
    } catch (e) {
      addToast('Error', 'Failed to toggle mode on backend server. Make sure server is running on port 4000.', 'info');
    }
  };

  // Handle Updating Exchange Fees via API
  const handleUpdateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExchangeForFee) return;
    
    const feeFraction = parseFloat(customFeeValue) / 100;
    if (isNaN(feeFraction) || feeFraction < 0) {
      addToast('Invalid Input', 'Please enter a valid percentage fee (>= 0)', 'info');
      return;
    }

    try {
      const response = await fetch(`http://${window.location.hostname}:4000/api/config/update-fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchangeId: selectedExchangeForFee, fee: feeFraction }),
      });
      const data = await response.json();
      if (data.success) {
        addToast(
          'Fee Configuration Saved',
          `Successfully updated standard fee of ${exchangesStatus[selectedExchangeForFee].name} to ${customFeeValue}%!`,
          'success'
        );
        setCustomFeeValue('');
        setSelectedExchangeForFee('');
      } else {
        addToast('Error', data.error || 'Failed to update fee', 'info');
      }
    } catch (error) {
      addToast('Error', 'Failed to update fee on backend server. Make sure server is running on port 4000.', 'info');
    }
  };

  // Compute stats
  const totalCoins = Object.keys(tickers).length;
  const activeOpps = opportunities.filter((o) => o.feeAdjustedProfitPercent > 0).length;
  const bestOpportunity = opportunities.length > 0 ? opportunities[0] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-900">
      
      {/* Reconnection / Error Toast Banner */}
      {!wsConnected && (
        <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-2 animate-pulse shadow-lg sticky top-0 z-50">
          <AlertTriangle className="h-4 w-4" />
          <span>Backend Server Offline (Port 4000). Trying to reconnect...</span>
          <span className="text-xs bg-red-800 px-2 py-0.5 rounded-full">Retrying</span>
        </div>
      )}

      {/* Floating Toast Notification Containers */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl border flex flex-col transform transition-all duration-300 translate-y-0 opacity-100 ${
              toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-100'
                : toast.type === 'alert'
                ? 'bg-amber-950/95 border-amber-500/40 text-amber-100 animate-bounce'
                : 'bg-blue-950/95 border-blue-500/30 text-blue-100'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {toast.type === 'success' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
              {toast.type === 'alert' && <Bell className="h-4 w-4 text-amber-400 animate-pulse" />}
              {toast.type === 'info' && <Database className="h-4 w-4 text-blue-400" />}
              <span>{toast.title}</span>
            </div>
            <p className="text-xs mt-1 opacity-90 leading-relaxed">{toast.body}</p>
          </div>
        ))}
      </div>

      {/* Main Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-emerald-500/10 shadow-lg">
              <TrendingUp className="h-6 w-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-emerald-400 via-teal-200 to-white bg-clip-text text-transparent">
                ARBITRAGE MONITOR
              </h1>
              <p className="text-xs text-slate-400 font-medium">Real-Time Multi-Exchange Arbitrage & Fee Calculator</p>
            </div>
          </div>

          {/* Quick Config Toggles */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Simulation Mode Selector */}
            <button
              onClick={handleToggleMock}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                useMockFallback
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-400 hover:bg-amber-900/40'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40'
              }`}
            >
              {useMockFallback ? <Cpu className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />}
              <span>Mode: {useMockFallback ? 'Live Mock Simulation' : 'Real Exchange APIs'}</span>
            </button>

            {/* Alert Settings Trigger */}
            <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs font-semibold">
              <Bell className={`h-3.5 w-3.5 ${alertsEnabled ? 'text-emerald-400 animate-swing' : 'text-slate-500'}`} />
              <span>Alert Threshold:</span>
              <input
                type="number"
                step="0.1"
                min="0.01"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Math.max(0.01, parseFloat(e.target.value) || 0.1))}
                className="w-12 bg-slate-950 border border-slate-700 px-1 py-0.5 rounded text-center text-slate-100 font-bold focus:outline-none focus:border-emerald-500 text-xs"
              />
              <span>%</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                addToast('Sound Settings', `Alert sounds ${!soundEnabled ? 'enabled' : 'disabled'}`, 'info');
              }}
              className={`p-2 rounded-lg border text-slate-300 transition-all ${
                soundEnabled 
                  ? 'bg-slate-800/80 border-emerald-500/30 text-emerald-400' 
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
              title={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>

            {/* Browser Notifications Permission Trigger */}
            {!browserNotificationsGranted && (
              <button
                onClick={requestNotificationPermission}
                className="flex items-center gap-1.5 bg-blue-900/40 hover:bg-blue-800/40 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                <Bell className="h-3.5 w-3.5" />
                Enable System Alerts
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">

        {/* Overview cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-slate-850 text-emerald-400 border border-slate-800">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Tracking Pairs</p>
              <p className="text-lg font-black text-slate-100">{totalCoins || 5} Pairs</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-slate-850 text-blue-400 border border-slate-800">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Exchanges Loaded</p>
              <p className="text-lg font-black text-slate-100">
                {Object.keys(exchangesStatus).length || 7} Platforms
              </p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-slate-850 text-teal-400 border border-slate-800">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Profitable Spreads</p>
              <p className="text-lg font-black text-emerald-400">{activeOpps} Found</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-slate-850 text-pink-400 border border-slate-800">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Highest Profit</p>
              <p className={`text-lg font-black ${bestOpportunity && bestOpportunity.feeAdjustedProfitPercent > 0.5 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {bestOpportunity ? `${bestOpportunity.feeAdjustedProfitPercent.toFixed(2)}%` : '0.00%'}
              </p>
            </div>
          </div>
        </section>

        {/* Exchange Connection Grid */}
        <section className="bg-slate-900/30 border border-slate-800/60 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Exchange API Status & Real-Time Configured Fees
            </h3>
            <span className="text-slate-500 text-xxs font-mono">Poll: 2.5s interval</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {Object.values(exchangesStatus).map((ex) => (
              <div 
                key={ex.id} 
                className={`p-2.5 rounded-lg border text-center relative transition-all ${
                  ex.online 
                    ? 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/20' 
                    : 'bg-red-950/10 border-red-900/30 hover:border-red-500/20'
                }`}
                title={ex.error ? `Last error: ${ex.error}` : 'Online'}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${ex.online ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 animate-ping'}`} />
                  <span className="text-xs font-bold truncate block max-w-full text-slate-200">{ex.name}</span>
                </div>
                <div className="text-xxs text-slate-400 mt-1 font-mono">
                  Fee: <span className="text-slate-300 font-semibold">{(ex.fee * 100).toFixed(2)}%</span>
                </div>
                {!ex.online && (
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Dashboard Tabs & Actions */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Navigation Tabs */}
          <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('arbitrage')}
              className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                activeTab === 'arbitrage' 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Arbitrage Ranked
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                activeTab === 'matrix' 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Price Matrix
            </button>
            <button
              onClick={() => setActiveTab('fees')}
              className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                activeTab === 'fees' 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Adjust Fees
            </button>
          </div>

          <div className="text-xxs text-slate-400 font-mono italic">
            * Sorting automatically by <strong className="text-emerald-400">Net Profit %</strong> after taking standard taker/maker fees into account.
          </div>
        </section>

        {/* Tab Content Panels */}
        
        {/* TAB 1: Ranked Opportunities */}
        {activeTab === 'arbitrage' && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-xxs font-extrabold text-slate-400 uppercase tracking-widest">
                    <th className="py-4 px-6">Coin Pair</th>
                    <th className="py-4 px-4">Buy Exchange</th>
                    <th className="py-4 px-4">Sell Exchange</th>
                    <th className="py-4 px-4 text-right">Buy Ask Price</th>
                    <th className="py-4 px-4 text-right">Sell Bid Price</th>
                    <th className="py-4 px-4 text-right">Raw Spread</th>
                    <th className="py-4 px-4 text-right">Fee-Adjusted Profit</th>
                    <th className="py-4 px-6 text-right">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {opportunities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 text-sm font-medium">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-600" />
                        No ticker prices received yet. Connecting to service...
                      </td>
                    </tr>
                  ) : (
                    opportunities.map((opp) => {
                      // Color coding classification
                      // green (>0.5% profit), yellow (0-0.5%), red (negative/no opportunity)
                      let bgClass = 'hover:bg-slate-850/40';
                      let badgeClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
                      let profitColor = 'text-red-400';

                      if (opp.feeAdjustedProfitPercent > 0.5) {
                        bgClass = 'bg-emerald-950/5 hover:bg-emerald-950/15';
                        badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                        profitColor = 'text-emerald-400';
                      } else if (opp.feeAdjustedProfitPercent > 0) {
                        bgClass = 'bg-amber-950/5 hover:bg-amber-950/15';
                        badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                        profitColor = 'text-amber-400';
                      }

                      return (
                        <tr key={opp.pair} className={`transition-all text-xs font-semibold ${bgClass}`}>
                          <td className="py-4.5 px-6 font-black text-slate-100 flex items-center gap-2">
                            <span className="p-1 rounded-md bg-slate-800 text-slate-300 text-xxs">SPOT</span>
                            {opp.pair}
                          </td>
                          <td className="py-4.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                              <span className="capitalize text-slate-200">{opp.buyExchange}</span>
                            </div>
                          </td>
                          <td className="py-4.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                              <span className="capitalize text-slate-200">{opp.sellExchange}</span>
                            </div>
                          </td>
                          <td className="py-4.5 px-4 text-right font-mono text-slate-200">
                            ${opp.buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                          </td>
                          <td className="py-4.5 px-4 text-right font-mono text-slate-200">
                            ${opp.sellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                          </td>
                          <td className="py-4.5 px-4 text-right font-mono text-slate-300">
                            <span className={opp.rawSpreadPercent > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                              {opp.rawSpreadPercent > 0 ? '+' : ''}{opp.rawSpreadPercent.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-4.5 px-4 text-right">
                            <span className={`px-2.5 py-1 rounded-lg font-extrabold text-xs tracking-wide ${badgeClass}`}>
                              {opp.feeAdjustedProfitPercent > 0 ? '+' : ''}{opp.feeAdjustedProfitPercent.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-4.5 px-6 text-right font-mono text-slate-400 text-xxs">
                            {new Date(opp.lastUpdated).toLocaleTimeString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Live Price Matrix Grid */}
        {activeTab === 'matrix' && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-100">Live Exchange Pricing Matrix</h2>
                <p className="text-xs text-slate-400">View buy (Ask) and sell (Bid) quotes for all 5 currency pairs across the 7 exchanges simultaneously.</p>
              </div>
              <div className="text-xxs text-slate-400 font-semibold bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                Format: <span className="text-purple-400 font-bold">BID (SELL)</span> / <span className="text-blue-400 font-bold">ASK (BUY)</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-xxs font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-4">Cryptocurrency</th>
                    {Object.values(exchangesStatus).map((ex) => (
                      <th key={ex.id} className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-slate-200">{ex.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${ex.online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {ex.online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {Object.keys(tickers).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500 text-xs">
                        No prices loaded. Connecting to WebSocket...
                      </td>
                    </tr>
                  ) : (
                    Object.keys(tickers).map((pair) => (
                      <tr key={pair} className="hover:bg-slate-850/20 text-xs font-semibold">
                        <td className="py-4 px-4 font-black text-slate-200">{pair}</td>
                        {Object.values(exchangesStatus).map((ex) => {
                          const ticker = tickers[pair]?.[ex.id];
                          if (!ticker || ticker.bid <= 0 || ticker.ask <= 0) {
                            return (
                              <td key={ex.id} className="py-4 px-4 text-center text-slate-500 font-mono text-xxs italic">
                                stale / offline
                              </td>
                            );
                          }
                          return (
                            <td key={ex.id} className="py-4 px-4 text-center font-mono">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-purple-400 hover:underline cursor-pointer font-bold" title={`${ex.name} ${pair} Best Bid (Sell price)`}>
                                  ${ticker.bid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                </span>
                                <span className="text-slate-500 font-normal">|</span>
                                <span className="text-blue-400 hover:underline cursor-pointer font-bold" title={`${ex.name} ${pair} Best Ask (Buy price)`}>
                                  ${ticker.ask.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Adjust Fee Settings */}
        {activeTab === 'fees' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Fee config form */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 shadow-2xl space-y-6">
              <div>
                <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-emerald-400" /> Custom Exchange Fee Structure
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust trading fee percentages dynamically. Changes will submit to the Node.js backend server and immediately recalculate and re-rank all live arbitrage opportunities.
                </p>
              </div>

              <form onSubmit={handleUpdateFee} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Exchange</label>
                  <select
                    value={selectedExchangeForFee}
                    onChange={(e) => {
                      setSelectedExchangeForFee(e.target.value);
                      if (e.target.value) {
                        setCustomFeeValue((exchangesStatus[e.target.value].fee * 100).toString());
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-100 text-xs font-bold focus:outline-none focus:border-emerald-500"
                    required
                  >
                    <option value="">-- Choose Platform --</option>
                    {Object.values(exchangesStatus).map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} (Current: {(ex.fee * 100).toFixed(3)}%)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedExchangeForFee && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Trading Fee Percentage (%)
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max="5.0"
                          value={customFeeValue}
                          onChange={(e) => setCustomFeeValue(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. 0.10"
                          required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold">%</span>
                      </div>
                      <button
                        type="submit"
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-6 py-3 rounded-lg text-xs font-black tracking-wide transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
                      >
                        Apply Fee
                      </button>
                    </div>
                  </div>
                )}
              </form>

              {/* Developer notice on where to adjust standard fee rates */}
              <div className="bg-slate-950/60 p-4.5 rounded-lg border border-slate-800/80 space-y-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-blue-400" /> Developer Reference Rate Customization
                </h4>
                <p className="text-xxs text-slate-400 leading-relaxed">
                  The primary fee structure parameters are declared inside <strong className="text-slate-200">crypto-arbitrage/src/config/arbitrageConfig.ts</strong>. You can configure exchange objects with respective maker/taker default fees there.
                </p>
                <p className="text-xxs text-slate-400 leading-relaxed">
                  In a real trading bot setup, you could dynamically query each exchange&apos;s trade fee endpoint (e.g. KuCoin <code className="text-amber-400">/api/v1/trade-fees</code>) using authenticated account keys to replace these standard approximations.
                </p>
              </div>
            </div>

            {/* Current Fees Summary */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 shadow-2xl flex flex-col justify-between">
              <div>
                <h2 className="text-base font-black text-slate-100">Active Platform Fee Tiers</h2>
                <p className="text-xs text-slate-400 mt-1">These are the currently applied fees used to compute the Net Fee-Adjusted spreads.</p>
                
                <div className="mt-4 divide-y divide-slate-800/80 border border-slate-800/80 rounded-lg overflow-hidden bg-slate-950/40">
                  {Object.values(exchangesStatus).map((ex) => (
                    <div key={ex.id} className="flex justify-between items-center px-4 py-3 text-xs font-semibold">
                      <span className="text-slate-300">{ex.name}</span>
                      <div className="font-mono text-slate-100 flex items-center gap-2">
                        <span>{(ex.fee * 100).toFixed(3)}%</span>
                        <span className="text-[10px] text-slate-500 uppercase">({(ex.fee * 10000).toFixed(0)} bps)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 p-4.5 bg-slate-950/40 rounded-lg border border-slate-800/40">
                <div className="text-xxs font-mono text-slate-400 space-y-1">
                  <span className="font-black text-slate-200 block mb-1">Arbitrage Margin Formula:</span>
                  <div className="text-teal-400 font-bold bg-slate-950 p-2 rounded text-center">
                    Net Profit % = [ (Bid_Sell * (1 - Fee_Sell)) / (Ask_Buy * (1 + Fee_Buy)) - 1 ] * 100
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-900/40 px-6 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>&copy; {new Date().getFullYear()} Real-Time Crypto Arbitrage Dashboard. All Rights Reserved.</span>
          <div className="flex gap-4 font-semibold text-slate-400">
            <span className="hover:text-slate-300 cursor-pointer">Documentation</span>
            <span>&bull;</span>
            <span className="hover:text-slate-300 cursor-pointer">API References</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
