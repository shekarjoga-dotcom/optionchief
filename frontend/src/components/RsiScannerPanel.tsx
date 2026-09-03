import React, { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { BACKEND_URL } from '../config';
import { 
  Play, Trash2, Plus, RefreshCw, CheckCircle2, 
  AlertTriangle, TrendingUp, TrendingDown, Info, Activity
} from 'lucide-react';
import { 
  ResponsiveContainer, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, ReferenceLine, Legend, LineChart, Line, ComposedChart, Scatter
} from 'recharts';

interface RSIScannerConfig {
  id: string;
  symbol: string;
  timeframe: string;
  rsi_period: number;
  rsi_upper: number;
  rsi_lower: number;
  lot_size: number;
  moneyness: string;
  auto_execute: boolean;
  tp_pct: number;
  sl_pct: number;
  active: boolean;
}

interface RSIScannerLog {
  id: string;
  symbol: string;
  direction: string;
  trigger_time: string;
  spot_price: number;
  rsi_value: number;
  option_leg_details: {
    strike: number;
    optionType: string;
    expiry: string;
    entryPrice: number;
    quantity: number;
  };
  status: string;
  realized_pnl: number;
}

export default function RsiScannerPanel({ onNavigateToBacktest }: { onNavigateToBacktest?: () => void } = {}) {
  const { token, user } = useStore();
  
  // State
  const [configs, setConfigs] = useState<RSIScannerConfig[]>([]);
  const [logs, setLogs] = useState<RSIScannerLog[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BANKNIFTY");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("5m");
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartSignals, setChartSignals] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [loadingChart, setLoadingChart] = useState<boolean>(false);
  
  // New configuration form state
  const [formSymbol, setFormSymbol] = useState<string>("BANKNIFTY");
  const [formTimeframe, setFormTimeframe] = useState<string>("5m");
  const [formRsiPeriod, setFormRsiPeriod] = useState<number>(3);
  const [formRsiUpper, setFormRsiUpper] = useState<number>(80);
  const [formRsiLower, setFormRsiLower] = useState<number>(20);
  const [formLotSize, setFormLotSize] = useState<number>(1);
  const [formMoneyness, setFormMoneyness] = useState<string>("ATM");
  const [formAutoExecute, setFormAutoExecute] = useState<boolean>(true);
  const [formTpPct, setFormTpPct] = useState<number>(30);
  const [formSlPct, setFormSlPct] = useState<number>(15);

  // Fetch configs & logs
  const fetchData = async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      const configRes = await fetch(`${BACKEND_URL}/api/rsi-scanner/configs`, { headers });
      if (configRes.ok) {
        const data = await configRes.json();
        setConfigs(data);
      }
      
      const logsRes = await fetch(`${BACKEND_URL}/api/rsi-scanner/logs`, { headers });
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Error fetching scanner data:", e);
    }
  };

  // Fetch chart candle data
  const fetchChartData = async (symbol: string, timeframe: string) => {
    setLoadingChart(true);
    try {
      const rsiPeriod = configs.find(c => c.symbol === symbol)?.rsi_period || 3;
      const response = await fetch(
        `${BACKEND_URL}/api/rsi-scanner/chart-data?symbol=${symbol}&timeframe=${timeframe}&rsi_period=${rsiPeriod}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setChartData(data.candles || []);
        
        // Map signals to chart format
        const signalsMap = (data.signals || []).map((s: any) => ({
          timestamp: s.timestamp,
          spot_price: s.spot_price,
          direction: s.direction,
          rsi_value: s.rsi_value,
          label: s.direction === 'BULLISH_CE' ? 'CE BUY' : 'PE BUY'
        }));
        setChartSignals(signalsMap);
      }
    } catch (e) {
      console.error("Error fetching scanner chart data:", e);
    } finally {
      setLoadingChart(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // refresh configurations & logs every 10 seconds
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    fetchChartData(selectedSymbol, selectedTimeframe);
  }, [selectedSymbol, selectedTimeframe, configs]);

  // Create new rule
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'viewer') return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/rsi-scanner/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          symbol: formSymbol,
          timeframe: formTimeframe,
          rsi_period: formRsiPeriod,
          rsi_upper: formRsiUpper,
          rsi_lower: formRsiLower,
          lot_size: formLotSize,
          moneyness: formMoneyness,
          auto_execute: formAutoExecute,
          tp_pct: formTpPct,
          sl_pct: formSlPct,
          active: true
        })
      });

      if (response.ok) {
        fetchData();
        // Reset form or set defaults
        setFormAutoExecute(false);
      } else {
        const err = await response.json();
        alert(`Failed to save scanner rule: ${err.detail}`);
      }
    } catch (e) {
      console.error("Error saving config:", e);
    }
  };

  // Delete config
  const handleDeleteConfig = async (id: string) => {
    if (user?.role === 'viewer') return;
    if (!confirm("Are you sure you want to delete this scanner rule?")) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/rsi-scanner/configs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Error deleting rule:", e);
    }
  };

  // Toggle config active status
  const handleToggleActive = async (config: RSIScannerConfig) => {
    if (user?.role === 'viewer') return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/rsi-scanner/configs?config_id=${config.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          symbol: config.symbol,
          timeframe: config.timeframe,
          rsi_period: config.rsi_period,
          rsi_upper: config.rsi_upper,
          rsi_lower: config.rsi_lower,
          lot_size: config.lot_size,
          moneyness: config.moneyness,
          auto_execute: config.auto_execute,
          tp_pct: config.tp_pct,
          sl_pct: config.sl_pct,
          active: !config.active
        })
      });
      if (response.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Error toggling active status:", e);
    }
  };

  // Toggle config auto_execute status
  const handleToggleAutoExecute = async (config: RSIScannerConfig) => {
    if (user?.role === 'viewer') return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/rsi-scanner/configs?config_id=${config.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          symbol: config.symbol,
          timeframe: config.timeframe,
          rsi_period: config.rsi_period,
          rsi_upper: config.rsi_upper,
          rsi_lower: config.rsi_lower,
          lot_size: config.lot_size,
          moneyness: config.moneyness,
          auto_execute: !config.auto_execute,
          tp_pct: config.tp_pct,
          sl_pct: config.sl_pct,
          active: config.active
        })
      });
      if (response.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Error toggling auto execute:", e);
    }
  };

  // Open this rule in Strategy Backtester / Optimizer
  const handleBacktestConfig = (cfg: RSIScannerConfig) => {
    localStorage.setItem('OC_RSI_BACKTEST_CONFIG', JSON.stringify({
      symbol: cfg.symbol,
      rsi_period: cfg.rsi_period,
      rsi_upper: cfg.rsi_upper,
      rsi_lower: cfg.rsi_lower,
      moneyness: cfg.moneyness,
      lot_size: cfg.lot_size,
      tp_pct: cfg.tp_pct,
      sl_pct: cfg.sl_pct,
      timeframe: cfg.timeframe
    }));
    window.dispatchEvent(new Event('rsi_backtest_load'));
    window.location.hash = 'backtest';
    if (onNavigateToBacktest) {
      onNavigateToBacktest();
    }
  };

  // Trigger manual scan cycle
  const handleManualScan = async () => {
    setIsScanning(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/rsi-scanner/scan-now`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const resData = await response.json();
        await fetchData();
        fetchChartData(selectedSymbol, selectedTimeframe);
        if (resData.message) {
          alert(resData.message);
        }
      }
    } catch (e) {
      console.error("Error triggering scan:", e);
    } finally {
      setTimeout(() => setIsScanning(false), 1500);
    }
  };

  // Merge signals into candlestick data for charting
  const getChartDataWithSignals = () => {
    return chartData.map(c => {
      const matchedSig = chartSignals.find(s => s.timestamp === c.timestamp);
      return {
        ...c,
        signalPrice: matchedSig ? matchedSig.spot_price : null,
        signalType: matchedSig ? matchedSig.direction : null,
        signalLabel: matchedSig ? matchedSig.label : null
      };
    });
  };

  const chartDataCombined = getChartDataWithSignals();
  const ceSignalsList = chartDataCombined.filter(d => d.signalType === 'BULLISH_CE');
  const peSignalsList = chartDataCombined.filter(d => d.signalType === 'BEARISH_PE');

  return (
    <div className="space-y-6 text-gray-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-slate-900 border border-slate-800 p-6 rounded-2xl gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 animate-pulse">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Intraday RSI Breakout Scanner</h1>
              <p className="text-sm text-slate-400">Automated option buying via sensitive RSI momentum and price action triggers</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchChartData(selectedSymbol, selectedTimeframe)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 font-medium transition duration-200"
          >
            <RefreshCw className={`h-4 w-4 ${loadingChart ? 'animate-spin' : ''}`} />
            Sync Chart
          </button>
          <button 
            onClick={handleManualScan}
            disabled={isScanning || user?.role === 'viewer'}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/40 disabled:text-emerald-400/50 text-white rounded-xl font-semibold shadow-lg shadow-emerald-950/20 border border-emerald-500 transition duration-200"
          >
            <Play className={`h-4 w-4 ${isScanning ? 'animate-ping' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Form & Rules Config */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* Create Scanner Form */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Plus className="h-5 w-5 text-emerald-400" />
              Add Scanner Rule
            </h2>
            
            <form onSubmit={handleCreateRule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Asset Symbol</label>
                  <select
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BANKNIFTY">Bank Nifty</option>
                    <option value="NIFTY">Nifty 50</option>
                    <option value="SENSEX">Sensex</option>
                    <option value="RELIANCE">Reliance</option>
                    <option value="GOLD">Gold MCX</option>
                    <option value="SILVER">Silver MCX</option>
                    <option value="CRUDEOIL">Crude Oil MCX</option>
                    <option value="NATURALGAS">Natural Gas MCX</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Candle Interval</label>
                  <select
                    value={formTimeframe}
                    onChange={(e) => setFormTimeframe(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="3m">3 Minute</option>
                    <option value="5m">5 Minute</option>
                    <option value="15m">15 Minute</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">RSI Period</label>
                  <input
                    type="number"
                    value={formRsiPeriod}
                    onChange={(e) => setFormRsiPeriod(Number(e.target.value))}
                    min="2" max="50"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Bullish Over</label>
                  <input
                    type="number"
                    value={formRsiUpper}
                    onChange={(e) => setFormRsiUpper(Number(e.target.value))}
                    min="50" max="95"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Bearish Under</label>
                  <input
                    type="number"
                    value={formRsiLower}
                    onChange={(e) => setFormRsiLower(Number(e.target.value))}
                    min="5" max="50"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-800/60 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Moneyness</label>
                  <select
                    value={formMoneyness}
                    onChange={(e) => setFormMoneyness(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ATM">ATM (At the money)</option>
                    <option value="OTM1">OTM +1 Strike</option>
                    <option value="OTM2">OTM +2 Strikes</option>
                    <option value="ITM">ITM -1 Strike</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Lot Count</label>
                  <input
                    type="number"
                    value={formLotSize}
                    onChange={(e) => setFormLotSize(Math.max(1, Number(e.target.value)))}
                    min="1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-800/60 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Target (TP %)</label>
                  <input
                    type="number"
                    value={formTpPct}
                    onChange={(e) => setFormTpPct(Number(e.target.value))}
                    min="1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Stop Loss (SL %)</label>
                  <input
                    type="number"
                    value={formSlPct}
                    onChange={(e) => setFormSlPct(Number(e.target.value))}
                    min="1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="autoExecute"
                  checked={formAutoExecute}
                  onChange={(e) => setFormAutoExecute(e.target.checked)}
                  className="h-4.5 w-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-800 bg-slate-900"
                />
                <label htmlFor="autoExecute" className="text-sm font-medium text-slate-200 select-none cursor-pointer">
                  Auto-Execute in Paper Book
                </label>
              </div>

              <button
                type="submit"
                disabled={user?.role === 'viewer'}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/40 text-white rounded-xl font-bold border border-emerald-500 shadow-md transition duration-200"
              >
                Create Scanner Rule
              </button>
            </form>
          </div>

          {/* Active Rules List */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-3">Active Rules ({configs.length})</h2>
            
            {configs.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No scanner rules configured.</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {configs.map((config) => (
                  <div key={config.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{config.symbol}</span>
                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-semibold">{config.timeframe}</span>
                        {config.auto_execute && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Auto</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        RSI({config.rsi_period}) levels: {config.rsi_lower}/{config.rsi_upper} | Moneyness: {config.moneyness}
                      </p>
                      <p className="text-xs text-slate-500">
                        Lots: {config.lot_size} | TP: {config.tp_pct}% | SL: {config.sl_pct}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleBacktestConfig(config)}
                        title="Backtest and optimize this RSI rule in Backtester"
                        className="text-xs px-2 py-1 rounded-md font-semibold bg-amber-500/15 hover:bg-amber-500 hover:text-black border border-amber-500/30 text-amber-400 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <span>🧪</span>
                        <span>Backtest</span>
                      </button>
                      <button 
                        onClick={() => handleToggleAutoExecute(config)}
                        disabled={user?.role === 'viewer'}
                        title="Toggle Auto Execute to Paper Trading Book"
                        className={`text-xs px-2 py-1 rounded-md font-semibold border transition-all cursor-pointer ${
                          config.auto_execute 
                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' 
                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {config.auto_execute ? '⚡ Auto: ON' : '🔔 Auto: OFF'}
                      </button>
                      <button 
                        onClick={() => handleToggleActive(config)}
                        disabled={user?.role === 'viewer'}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all cursor-pointer ${config.active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                      >
                        {config.active ? 'Active' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(config.id)}
                        disabled={user?.role === 'viewer'}
                        className="p-1.5 bg-slate-900 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition duration-150 cursor-pointer"
                        title="Delete Rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Charts & Overlay */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Chart Panel */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Live overlay charts</h2>
                {loadingChart && <span className="text-xs text-slate-400 animate-pulse">Syncing...</span>}
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="BANKNIFTY">Bank Nifty</option>
                  <option value="NIFTY">Nifty 50</option>
                  <option value="SENSEX">Sensex</option>
                  <option value="RELIANCE">Reliance</option>
                  <option value="GOLD">Gold MCX</option>
                  <option value="SILVER">Silver MCX</option>
                  <option value="CRUDEOIL">Crude Oil MCX</option>
                  <option value="NATURALGAS">Natural Gas MCX</option>
                </select>
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="3m">3 Minute</option>
                  <option value="5m">5 Minute</option>
                  <option value="15m">15 Minute</option>
                </select>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <div className="text-center">
                  <Play className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No historical candles retrieved. Make sure market is open or check fallback settings.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Spot Price Line Chart */}
                <div className="h-[230px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartDataCombined}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="timestamp" stroke="#64748b" tickFormatter={(v) => v.split(' ')[1] || v} />
                      <YAxis stroke="#64748b" domain={['auto', 'auto']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                        labelFormatter={(v) => `Time: ${v}`}
                      />
                      <Area type="monotone" dataKey="close" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#priceGradient)" name="Underlying price" />
                      
                      {/* CE Scatter markers */}
                      <Scatter 
                        data={ceSignalsList} 
                        fill="#10b981" 
                        shape="triangle" 
                        legendType="triangle" 
                        name="Bullish CE breakout" 
                        dataKey="spot_price"
                      />
                      
                      {/* PE Scatter markers */}
                      <Scatter 
                        data={peSignalsList} 
                        fill="#ef4444" 
                        shape="triangle" 
                        legendType="triangle" 
                        name="Bearish PE breakdown" 
                        dataKey="spot_price"
                      />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* RSI Indicator Sub-chart */}
                <div className="h-[140px] border-t border-slate-800/80 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDataCombined}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="timestamp" stroke="#64748b" tickFormatter={(v) => v.split(' ')[1] || v} hide />
                      <YAxis stroke="#64748b" domain={[0, 100]} ticks={[0, 20, 50, 80, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                        labelFormatter={(v) => `Time: ${v}`}
                      />
                      <Line type="monotone" dataKey="rsi" stroke="#fbbf24" strokeWidth={1.5} dot={false} name="RSI" />
                      <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '80', fill: '#ef4444', position: 'right' }} />
                      <ReferenceLine y={20} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: '20', fill: '#3b82f6', position: 'right' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Trigger logs */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-3">Matched Breakout Logs (Audit Log)</h2>
            
            {logs.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-25" />
                <p className="text-sm">No signals matched yet. Waiting for candle breakout...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase text-slate-400 bg-slate-950/60 border-b border-slate-850">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Symbol</th>
                      <th className="px-4 py-3">Signal Type</th>
                      <th className="px-4 py-3">Spot at Trigger</th>
                      <th className="px-4 py-3">RSI</th>
                      <th className="px-4 py-3">Leg Option Contract</th>
                      <th className="px-4 py-3">Execution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-950/40 transition duration-150">
                        <td className="px-4 py-3 font-medium text-slate-400">{log.trigger_time}</td>
                        <td className="px-4 py-3 font-semibold text-white">{log.symbol}</td>
                        <td className="px-4 py-3">
                          {log.direction === 'BULLISH_CE' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/20">
                              <TrendingUp className="h-3 w-3" /> CE Breakout
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-red-500/20">
                              <TrendingDown className="h-3 w-3" /> PE Breakdown
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold">₹{log.spot_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 font-mono text-yellow-400 font-semibold">{log.rsi_value.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {log.option_leg_details ? (
                            <span className="text-xs font-mono text-slate-300">
                              {log.symbol} {log.option_leg_details.expiry} {log.option_leg_details.strike} {log.option_leg_details.optionType}E @ ₹{log.option_leg_details.entryPrice}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {log.status === 'EXECUTED' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              <CheckCircle2 className="h-3 w-3" /> Auto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 text-xs px-2.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                              Alert Only
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
