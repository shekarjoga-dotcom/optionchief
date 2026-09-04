import { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { BACKEND_URL } from '../config';
import { 
  Code2, Play, CheckCircle2, AlertTriangle, RefreshCw, Save, 
  Sliders, Activity, Zap, HelpCircle, FileCode, Check
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, ReferenceLine 
} from 'recharts';

interface Preset {
  id: string;
  name: string;
  description: string;
  timeframe: string;
  moneyness: string;
  tp_pct: number;
  sl_pct: number;
  code: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string | null;
  indicators: Array<{ type: string; params: any; raw: string }>;
  buyCeExpr?: string;
  buyPeExpr?: string;
  recentTriggers?: number;
  sampleSignals?: any[];
}

export default function CustomStrategyStudio() {
  const { token } = useStore();

  // Sub-tabs
  const [subTab, setSubTab] = useState<'editor' | 'scanner' | 'backtest' | 'optimizer'>('editor');

  // Strategy configuration state
  const [strategyName, setStrategyName] = useState<string>("My Chartink Strategy");
  const [code, setCode] = useState<string>(`// === CHARTINK CUSTOM STRATEGY ===
// Bullish Rule (CALL Option Entry):
BUY_CE: [0] Close > [0] EMA(20) and EMA(9) crosses above EMA(21) and RSI(14) > 55

// Bearish Rule (PUT Option Entry):
BUY_PE: [0] Close < [0] EMA(20) and EMA(9) crosses below EMA(21) and RSI(14) < 45

// Target & Stop Loss Settings:
TP = 25%
SL = 12%
`);
  const [symbol, setSymbol] = useState<string>("BANKNIFTY");
  const [timeframe, setTimeframe] = useState<string>("5m");
  const [moneyness, setMoneyness] = useState<string>("ATM");
  const [tpPct, setTpPct] = useState<number>(25);
  const [slPct, setSlPct] = useState<number>(12);
  const [lotSize, setLotSize] = useState<number>(1);
  const [initialCapital, setInitialCapital] = useState<number>(100000);

  // Presets & validation
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");

  // Scanner state
  const [scanSymbols, setScanSymbols] = useState<string[]>(["BANKNIFTY", "NIFTY", "FINNIFTY", "SENSEX"]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [scanTimestamp, setScanTimestamp] = useState<string>("");

  // Backtester state
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);
  const [backtestResults, setBacktestResults] = useState<any | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  // Optimizer state
  const [optTpRange, setOptTpRange] = useState<number[]>([15, 25, 35]);
  const [optSlRange, setOptSlRange] = useState<number[]>([10, 15, 20]);
  const [optMoneynessRange, setOptMoneynessRange] = useState<string[]>(["ATM", "OTM1"]);
  const [optObjective, setOptObjective] = useState<string>("netReturnPct");
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optResults, setOptResults] = useState<any[]>([]);

  // 1. Load Strategy Presets on Mount
  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-strategy/presets`);
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (e) {
      console.error("Failed to load presets:", e);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = presets.find(x => x.id === presetId);
    if (p) {
      setStrategyName(p.name);
      setCode(p.code);
      setTimeframe(p.timeframe);
      setMoneyness(p.moneyness);
      setTpPct(p.tp_pct);
      setSlPct(p.sl_pct);
      setValidation(null);
    }
  };

  // 2. Validate User Code
  const handleValidateCode = async () => {
    setIsValidating(true);
    setValidation(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-strategy/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, symbol, timeframe })
      });
      const data = await res.json();
      if (res.ok) {
        setValidation(data);
      } else {
        setValidation({
          valid: false,
          error: data.detail || "Validation failed.",
          indicators: []
        });
      }
    } catch (e: any) {
      setValidation({
        valid: false,
        error: e.message || "Network error while validating code.",
        indicators: []
      });
    } finally {
      setIsValidating(false);
    }
  };

  // 3. Save Custom Strategy
  const handleSaveStrategy = async () => {
    if (!token) {
      alert("Please log in to save custom strategies to your account.");
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-strategy/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: strategyName,
          code,
          symbol,
          timeframe,
          moneyness,
          lot_size: lotSize,
          tp_pct: tpPct,
          sl_pct: slPct
        })
      });
      if (res.ok) {
        setSaveSuccessMsg("Strategy saved successfully!");
        setTimeout(() => setSaveSuccessMsg(""), 3000);
      } else {
        const err = await res.json();
        alert(`Error saving strategy: ${err.detail || 'Failed'}`);
      }
    } catch (e: any) {
      alert(`Network error: ${e.message}`);
    }
  };

  // 4. Run Scanner
  const handleRunScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-strategy/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          symbols: scanSymbols,
          timeframe,
          moneyness
        })
      });
      const data = await res.json();
      if (res.ok) {
        setScanResults(data.matches || []);
        setScanTimestamp(new Date().toLocaleTimeString());
      } else {
        alert(data.detail || "Scanner failed.");
      }
    } catch (e: any) {
      alert(`Scanner error: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // 5. Run Backtest
  const handleRunBacktest = async () => {
    setIsBacktesting(true);
    setBacktestError(null);
    setBacktestResults(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-strategy/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          code,
          startDate,
          endDate,
          timeframe,
          moneyness,
          takeProfitPct: tpPct,
          stopLossPct: slPct,
          initialCapital,
          lots: lotSize,
          slippagePerLeg: 0.5
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBacktestResults(data);
      } else {
        setBacktestError(data.detail || "Backtest failed.");
      }
    } catch (e: any) {
      setBacktestError(e.message || "Network error during backtest.");
    } finally {
      setIsBacktesting(false);
    }
  };

  // 6. Run Optimizer
  const handleRunOptimizer = async () => {
    setIsOptimizing(true);
    setOptResults([]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/custom-strategy/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          code,
          startDate,
          endDate,
          timeframe,
          tpRange: optTpRange,
          slRange: optSlRange,
          moneynessRange: optMoneynessRange,
          objective: optObjective
        })
      });
      const data = await res.json();
      if (res.ok) {
        setOptResults(data.results || []);
      } else {
        alert(data.detail || "Optimization failed.");
      }
    } catch (e: any) {
      alert(`Optimizer error: ${e.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Apply winning optimizer settings
  const handleApplyOptimizerWinner = (row: any) => {
    const p = row.parameters;
    setTpPct(p.takeProfitPct);
    setSlPct(p.stopLossPct);
    setMoneyness(p.moneyness);
    // Update code TP/SL
    let updatedCode = code;
    updatedCode = updatedCode.replace(/TP\s*=\s*[0-9\.]+%?/gi, `TP = ${p.takeProfitPct}%`);
    updatedCode = updatedCode.replace(/SL\s*=\s*[0-9\.]+%?/gi, `SL = ${p.stopLossPct}%`);
    setCode(updatedCode);
    setSubTab('editor');
    alert(`Applied Best Settings: TP +${p.takeProfitPct}%, SL -${p.stopLossPct}%, Moneyness ${p.moneyness}`);
  };

  return (
    <div className="flex flex-col gap-6 text-gray-200">
      
      {/* Top Header Card */}
      <div className="bg-cardClr border border-borderClr rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accentBrand/10 rounded-lg border border-accentBrand/30 text-accentBrand">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
                CUSTOM ALGO STUDIO <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">CHARTINK-STYLE ENGINE</span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Paste any custom trading rules or indicators. Verify syntax, scan real-time candles, backtest options simulations, and optimize parameters.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex bg-black/40 border border-borderClr/60 rounded-xl p-1 gap-1">
          <button
            onClick={() => setSubTab('editor')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'editor'
                ? 'bg-accentBrand text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>1. Code Window</span>
          </button>
          <button
            onClick={() => { setSubTab('scanner'); if (scanResults.length === 0) handleRunScan(); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'scanner'
                ? 'bg-accentBrand text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>2. Live Scanner</span>
          </button>
          <button
            onClick={() => setSubTab('backtest')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'backtest'
                ? 'bg-accentBrand text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>3. Backtester</span>
          </button>
          <button
            onClick={() => setSubTab('optimizer')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'optimizer'
                ? 'bg-accentBrand text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>4. Optimizer</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: CODE EDITOR */}
      {subTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Code Editor Box */}
          <div className="lg:col-span-2 bg-cardClr border border-borderClr rounded-xl p-5 flex flex-col gap-4">
            
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borderClr/40 pb-4">
              <div className="flex-1 min-w-[220px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Strategy Name
                </label>
                <input
                  type="text"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className="w-full bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-accentBrand"
                />
              </div>

              {/* Template Selector */}
              <div className="min-w-[200px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Load Template Preset
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-amber-300 font-semibold focus:outline-none focus:border-accentBrand"
                >
                  <option value="">-- Select a Preset --</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={handleSaveStrategy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-borderClr rounded-lg text-xs font-bold transition-all"
                  title="Save to database"
                >
                  <Save className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Save</span>
                </button>
                {saveSuccessMsg && (
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> {saveSuccessMsg}
                  </span>
                )}
              </div>
            </div>

            {/* Code Textarea */}
            <div className="relative flex flex-col flex-1">
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1 px-1">
                <span>Rule Syntax: <code className="text-accentBrand font-mono">BUY_CE: [Condition]</code> & <code className="text-pink-400 font-mono">BUY_PE: [Condition]</code></span>
                <span className="text-gray-500">Supports RSI, EMA, SMA, VWAP, Supertrend, MACD, BB, ATR</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => { setCode(e.target.value); setValidation(null); }}
                rows={16}
                className="w-full bg-black/70 border border-borderClr rounded-xl p-4 font-mono text-xs text-emerald-300 leading-relaxed focus:outline-none focus:border-accentBrand shadow-inner selection:bg-accentBrand/30"
                placeholder="Paste your Chartink / trading system rules here..."
                spellCheck={false}
              />
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleValidateCode}
                disabled={isValidating}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accentBrand to-amber-600 hover:from-accentBrand/90 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                {isValidating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Check & Validate Code</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSubTab('scanner'); handleRunScan(); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-xs font-bold rounded-lg border border-borderClr transition-all text-gray-300"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Scan Signals</span>
                </button>
                <button
                  onClick={() => { setSubTab('backtest'); handleRunBacktest(); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-xs font-bold rounded-lg border border-borderClr transition-all text-gray-300"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Run Backtest</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Validation Status & Execution Settings */}
          <div className="flex flex-col gap-5">
            
            {/* Validation Feedback Card */}
            <div className="bg-cardClr border border-borderClr rounded-xl p-5 flex flex-col gap-3">
              <h3 className="text-xs font-black tracking-wider text-gray-400 uppercase flex items-center justify-between">
                <span>Code Validation Status</span>
                {validation && (
                  <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold border ${
                    validation.valid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}>
                    {validation.valid ? 'VALIDATED' : 'SYNTAX ERROR'}
                  </span>
                )}
              </h3>

              {!validation && (
                <div className="p-4 rounded-lg bg-black/20 border border-borderClr/40 text-center text-xs text-gray-500">
                  Click <strong>"Check & Validate Code"</strong> to test rule parsing and indicator detection.
                </div>
              )}

              {validation && validation.valid && (
                <div className="flex flex-col gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Logic Verified Successfully</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Triggered <strong>{validation.recentTriggers || 0} sample signals</strong> on recent {symbol} candles.
                      </div>
                    </div>
                  </div>

                  {/* Detected Indicators */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                      Detected Technical Indicators ({validation.indicators.length})
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {validation.indicators.length > 0 ? (
                        validation.indicators.map((ind, i) => (
                          <span key={i} className="px-2 py-1 rounded bg-black/40 border border-accentBrand/30 text-accentBrand text-xs font-mono font-bold">
                            {ind.raw}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">None detected</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {validation && !validation.valid && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Syntax Parsing Error</div>
                    <div className="text-[11px] text-red-200 mt-0.5 font-mono break-all">{validation.error}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Execution & Trade Generation Rules */}
            <div className="bg-cardClr border border-borderClr rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-black tracking-wider text-gray-400 uppercase">
                Option Trade Rules
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Index / Underlying</label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-accentBrand"
                  >
                    <option value="BANKNIFTY">BANKNIFTY</option>
                    <option value="NIFTY">NIFTY</option>
                    <option value="FINNIFTY">FINNIFTY</option>
                    <option value="SENSEX">SENSEX</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Timeframe</label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-accentBrand"
                  >
                    <option value="1m">1 Minute</option>
                    <option value="3m">3 Minutes</option>
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="30m">30 Minutes</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Strike Moneyness</label>
                  <select
                    value={moneyness}
                    onChange={(e) => setMoneyness(e.target.value)}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-accentBrand"
                  >
                    <option value="ATM">ATM (At The Money)</option>
                    <option value="OTM1">OTM 1 (1 Strike Out)</option>
                    <option value="OTM2">OTM 2 (2 Strikes Out)</option>
                    <option value="ITM">ITM (1 Strike In)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Lot Size</label>
                  <input
                    type="number"
                    min={1}
                    value={lotSize}
                    onChange={(e) => setLotSize(parseInt(e.target.value) || 1)}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-accentBrand"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-emerald-400 block mb-1">Take Profit (%)</label>
                  <input
                    type="number"
                    value={tpPct}
                    onChange={(e) => setTpPct(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-accentBrand"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-red-400 block mb-1">Stop Loss (%)</label>
                  <input
                    type="number"
                    value={slPct}
                    onChange={(e) => setSlPct(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-red-400 font-bold focus:outline-none focus:border-accentBrand"
                  />
                </div>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="bg-black/30 border border-borderClr/40 rounded-xl p-4 text-[11px] text-gray-400 flex flex-col gap-1.5">
              <div className="text-white font-bold flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-accentBrand" /> Syntax Tips
              </div>
              <div>• Chartink clauses like <code>[0] Close &gt; [0] EMA(20)</code> work automatically.</div>
              <div>• Use <code>crosses above</code> or <code>crosses below</code> for crossovers.</div>
              <div>• Use <code>Supertrend(10, 3) is Bullish</code> or <code>== 1</code>.</div>
              <div>• Use <code>High[-1]</code> or <code>Low[-1]</code> for previous candle breakout.</div>
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 2: LIVE SIGNAL SCANNER */}
      {subTab === 'scanner' && (
        <div className="flex flex-col gap-6">
          <div className="bg-cardClr border border-borderClr rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Live Intraday Signal Radar
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Scanning watchlist for active breakout triggers based on your custom system code.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {scanTimestamp && (
                <span className="text-xs text-gray-400">
                  Last Scanned: <span className="text-white font-mono">{scanTimestamp}</span>
                </span>
              )}
              <button
                onClick={handleRunScan}
                disabled={isScanning}
                className="flex items-center gap-2 px-5 py-2.5 bg-accentBrand hover:bg-accentBrand/90 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning Watchlist...' : 'Scan Now'}</span>
              </button>
            </div>
          </div>

          {/* Scanner Watchlist Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">Watchlist:</span>
            {["BANKNIFTY", "NIFTY", "FINNIFTY", "SENSEX", "RELIANCE", "HDFCBANK"].map((sym) => {
              const active = scanSymbols.includes(sym);
              return (
                <button
                  key={sym}
                  onClick={() => {
                    setScanSymbols(prev => active ? prev.filter(s => s !== sym) : [...prev, sym]);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                    active
                      ? 'bg-accentBrand/20 text-accentBrand border-accentBrand/40'
                      : 'bg-black/30 text-gray-500 border-borderClr hover:text-gray-300'
                  }`}
                >
                  {sym}
                </button>
              );
            })}
          </div>

          {/* Scanner Results Table */}
          <div className="bg-cardClr border border-borderClr rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-black/40 border-b border-borderClr text-gray-400 uppercase font-bold text-[10px] tracking-wider">
                    <th className="p-3.5">Symbol</th>
                    <th className="p-3.5">Signal</th>
                    <th className="p-3.5">Trigger Time</th>
                    <th className="p-3.5">Spot Price</th>
                    <th className="p-3.5 text-cyan-400">Target Option Contract</th>
                    <th className="p-3.5">Est. Premium</th>
                    <th className="p-3.5">Lot Size</th>
                    <th className="p-3.5">Key Indicators</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderClr/30">
                  {scanResults.length > 0 ? (
                    scanResults.map((sig, idx) => {
                      const isCe = sig.direction === 'BULLISH_CE';
                      return (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3.5 font-bold text-white">{sig.symbol}</td>
                          <td className="p-3.5 font-bold">
                            <span className={`px-2 py-1 rounded-md text-[11px] font-extrabold border ${
                              isCe 
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                                : 'bg-pink-500/15 text-pink-400 border-pink-500/30'
                            }`}>
                              {isCe ? 'BUY CALL (CE)' : 'BUY PUT (PE)'}
                            </span>
                          </td>
                          <td className="p-3.5 text-gray-400 font-mono text-[11px]">{sig.triggerTime}</td>
                          <td className="p-3.5 font-bold text-white font-mono">₹{sig.spotPrice.toLocaleString()}</td>
                          <td className="p-3.5 font-mono font-bold text-cyan-300">
                            {sig.contractName}
                          </td>
                          <td className="p-3.5 font-bold text-white font-mono">
                            ₹{sig.estimatedPremium}
                          </td>
                          <td className="p-3.5 text-gray-400 font-mono">{sig.lotSize}</td>
                          <td className="p-3.5 text-gray-300 font-mono text-[11px]">
                            {Object.entries(sig.indicators || {}).map(([k, v]) => (
                              <span key={k} className="mr-2 px-1.5 py-0.5 rounded bg-black/40 border border-borderClr text-gray-300 text-[10px]">
                                {k}: <strong className="text-white">{String(v)}</strong>
                              </span>
                            ))}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => alert(`Simulated Paper Trade for ${sig.contractName} @ ₹${sig.estimatedPremium} placed!`)}
                              className="px-3 py-1 bg-accentBrand hover:bg-accentBrand/90 text-white text-[11px] font-bold rounded-md transition-all shadow"
                            >
                              Paper Trade
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-gray-500">
                        {isScanning ? (
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-accentBrand" />
                            <span>Scanning market candles for criteria...</span>
                          </div>
                        ) : (
                          <div>
                            No active breakout signals detected on the selected symbols in the latest candles.
                            <div className="text-[11px] text-gray-600 mt-1">
                              Wait for the next candle close or adjust your strategy thresholds in the <strong>Code Window</strong>.
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: BACKTESTER */}
      {subTab === 'backtest' && (
        <div className="flex flex-col gap-6">
          
          {/* Backtest Control Card */}
          <div className="bg-cardClr border border-borderClr rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Index</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-white font-bold"
                >
                  <option value="BANKNIFTY">BANKNIFTY</option>
                  <option value="NIFTY">NIFTY</option>
                  <option value="FINNIFTY">FINNIFTY</option>
                  <option value="SENSEX">SENSEX</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-white font-bold"
                >
                </input>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-white font-bold"
                >
                </input>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Initial Capital</label>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 100000)}
                  className="bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-white font-bold w-28"
                />
              </div>
            </div>

            <button
              onClick={handleRunBacktest}
              disabled={isBacktesting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              {isBacktesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{isBacktesting ? 'Simulating Trades...' : 'Run Historical Backtest'}</span>
            </button>
          </div>

          {backtestError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{backtestError}</span>
            </div>
          )}

          {backtestResults && (
            <div className="flex flex-col gap-6">
              
              {/* Performance Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-cardClr border border-borderClr rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Net Return</span>
                  <div className={`text-base font-black mt-1 ${backtestResults.metrics.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ₹{backtestResults.metrics.netPnL.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-gray-400">{backtestResults.metrics.netReturnPct}%</span>
                </div>

                <div className="bg-cardClr border border-borderClr rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Win Rate</span>
                  <div className="text-base font-black text-white mt-1">
                    {backtestResults.metrics.winRate}%
                  </div>
                  <span className="text-[11px] text-gray-400">{backtestResults.metrics.winningTrades}W / {backtestResults.metrics.losingTrades}L</span>
                </div>

                <div className="bg-cardClr border border-borderClr rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Profit Factor</span>
                  <div className="text-base font-black text-amber-400 mt-1">
                    {backtestResults.metrics.profitFactor}
                  </div>
                  <span className="text-[11px] text-gray-400">Gross W / L</span>
                </div>

                <div className="bg-cardClr border border-borderClr rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Max Drawdown</span>
                  <div className="text-base font-black text-red-400 mt-1">
                    {backtestResults.metrics.maxDrawdown}%
                  </div>
                  <span className="text-[11px] text-gray-400">Peak-to-trough</span>
                </div>

                <div className="bg-cardClr border border-borderClr rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Total Trades</span>
                  <div className="text-base font-black text-cyan-400 mt-1">
                    {backtestResults.metrics.totalTrades}
                  </div>
                  <span className="text-[11px] text-gray-400">Completed</span>
                </div>

                <div className="bg-cardClr border border-borderClr rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Target Hits</span>
                  <div className="text-base font-black text-emerald-400 mt-1">
                    {backtestResults.metrics.targetHits}
                  </div>
                  <span className="text-[11px] text-gray-400">{backtestResults.metrics.slHits} SL hits</span>
                </div>

                <div className="bg-cardClr border border-borderClr rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Avg Holding</span>
                  <div className="text-base font-black text-purple-400 mt-1">
                    {backtestResults.metrics.avgHoldingTime}
                  </div>
                  <span className="text-[11px] text-gray-400">Per position</span>
                </div>
              </div>

              {/* Equity Curve Chart */}
              <div className="bg-cardClr border border-borderClr rounded-xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">
                  Backtest Equity Curve (Capital Growth)
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={backtestResults.equityCurve || []}>
                      <defs>
                        <linearGradient id="customEquityGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262b35" />
                      <XAxis dataKey="timestamp" stroke="#6b7280" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#6b7280" domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', fontSize: '11px' }} />
                      <ReferenceLine y={initialCapital} stroke="#f59e0b" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="capital" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#customEquityGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed Trades Log */}
              <div className="bg-cardClr border border-borderClr rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 border-b border-borderClr flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
                    Detailed Trades Log ({backtestResults.trades.length})
                  </h3>
                  <span className="text-xs text-gray-500">Intraday Black-Scholes Option Model</span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-black/80 z-10 border-b border-borderClr text-gray-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Direction</th>
                        <th className="p-3">Entry Time</th>
                        <th className="p-3">Exit Time</th>
                        <th className="p-3">Strike & Type</th>
                        <th className="p-3">Entry Prem</th>
                        <th className="p-3">Exit Prem</th>
                        <th className="p-3">Exit Reason</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3 text-right">Net PnL (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderClr/30">
                      {backtestResults.trades.map((t: any) => (
                        <tr key={t.tradeId} className="hover:bg-white/5 font-mono">
                          <td className="p-3 text-gray-400">{t.tradeId}</td>
                          <td className="p-3 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.direction === 'BULLISH_CE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-pink-500/20 text-pink-400'
                            }`}>
                              {t.direction === 'BULLISH_CE' ? 'CE' : 'PE'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-300 text-[11px]">{t.entryDate}</td>
                          <td className="p-3 text-gray-300 text-[11px]">{t.exitDate}</td>
                          <td className="p-3 font-bold text-white">{t.strike} {t.optionType}</td>
                          <td className="p-3">₹{t.entryPrice}</td>
                          <td className="p-3">₹{t.exitPrice}</td>
                          <td className="p-3 font-sans text-gray-400 text-[11px]">{t.exitReason}</td>
                          <td className="p-3 text-gray-400 text-[11px]">{t.duration}</td>
                          <td className={`p-3 text-right font-bold ${t.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {t.netPnL >= 0 ? `+₹${t.netPnL}` : `-₹${Math.abs(t.netPnL)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: PARAMETER OPTIMIZER */}
      {subTab === 'optimizer' && (
        <div className="flex flex-col gap-6">
          <div className="bg-cardClr border border-borderClr rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-accentBrand" />
                Multi-Parameter Strategy Optimizer
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Simulate across multiple Take Profit, Stop Loss, and Moneyness parameters to discover highest profitability.
              </p>
            </div>

            <button
              onClick={handleRunOptimizer}
              disabled={isOptimizing}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-accentBrand to-amber-600 hover:from-accentBrand/90 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              {isOptimizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>{isOptimizing ? 'Sweeping Parameters...' : 'Run Parameter Sweep'}</span>
            </button>
          </div>

          {/* Optimizer Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-cardClr border border-borderClr rounded-xl p-5">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Take Profit % Range
              </label>
              <div className="flex flex-wrap gap-2">
                {[15, 20, 25, 30, 40, 50].map((v) => {
                  const active = optTpRange.includes(v);
                  return (
                    <button
                      key={v}
                      onClick={() => setOptTpRange(prev => active ? prev.filter(x => x !== v) : [...prev, v])}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                        active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-black/30 text-gray-500 border-borderClr'
                      }`}
                    >
                      {v}%
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Stop Loss % Range
              </label>
              <div className="flex flex-wrap gap-2">
                {[10, 15, 20, 30, 40].map((v) => {
                  const active = optSlRange.includes(v);
                  return (
                    <button
                      key={v}
                      onClick={() => setOptSlRange(prev => active ? prev.filter(x => x !== v) : [...prev, v])}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                        active ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-black/30 text-gray-500 border-borderClr'
                      }`}
                    >
                      {v}%
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Moneyness Sweep
              </label>
              <div className="flex flex-wrap gap-2">
                {["ATM", "OTM1", "OTM2"].map((m) => {
                  const active = optMoneynessRange.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => setOptMoneynessRange(prev => active ? prev.filter(x => x !== m) : [...prev, m])}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                        active ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'bg-black/30 text-gray-500 border-borderClr'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Rank Objective
              </label>
              <select
                value={optObjective}
                onChange={(e) => setOptObjective(e.target.value)}
                className="w-full bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold"
              >
                <option value="netReturnPct">Maximize Net Return (%)</option>
                <option value="profitFactor">Maximize Profit Factor</option>
                <option value="winRate">Maximize Win Rate (%)</option>
                <option value="maxDrawdown">Minimize Max Drawdown (%)</option>
              </select>
            </div>
          </div>

          {/* Optimizer Results Table */}
          <div className="bg-cardClr border border-borderClr rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-borderClr flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
                Ranked Permutations ({optResults.length})
              </h3>
              <span className="text-xs text-gray-500">Sorted by {optObjective}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-black/40 border-b border-borderClr text-gray-400 uppercase font-bold text-[10px]">
                    <th className="p-3">Rank</th>
                    <th className="p-3">Moneyness</th>
                    <th className="p-3 text-emerald-400">Take Profit</th>
                    <th className="p-3 text-red-400">Stop Loss</th>
                    <th className="p-3 text-right">Net Return (₹)</th>
                    <th className="p-3 text-right">Net Return (%)</th>
                    <th className="p-3 text-right">Win Rate</th>
                    <th className="p-3 text-right">Profit Factor</th>
                    <th className="p-3 text-right">Max DD</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderClr/30">
                  {optResults.length > 0 ? (
                    optResults.map((row, idx) => {
                      const p = row.parameters;
                      const m = row.metrics;
                      const isTop = idx === 0;
                      return (
                        <tr key={idx} className={`hover:bg-white/5 ${isTop ? 'bg-accentBrand/5' : ''}`}>
                          <td className="p-3 font-bold text-white flex items-center gap-1">
                            {isTop && <span className="text-amber-400">★</span>}
                            #{idx + 1}
                          </td>
                          <td className="p-3 font-bold text-cyan-300">{p.moneyness}</td>
                          <td className="p-3 text-emerald-400 font-bold">+{p.takeProfitPct}%</td>
                          <td className="p-3 text-red-400 font-bold">-{p.stopLossPct}%</td>
                          <td className={`p-3 text-right font-mono font-bold ${m.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ₹{m.netPnL.toLocaleString()}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${m.netReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {m.netReturnPct}%
                          </td>
                          <td className="p-3 text-right font-mono text-white">{m.winRate}%</td>
                          <td className="p-3 text-right font-mono font-bold text-amber-400">{m.profitFactor}</td>
                          <td className="p-3 text-right font-mono text-gray-400">{m.maxDrawdown}%</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleApplyOptimizerWinner(row)}
                              className="px-2.5 py-1 bg-accentBrand/20 hover:bg-accentBrand text-accentBrand hover:text-white border border-accentBrand/40 text-[11px] font-bold rounded-md transition-all"
                            >
                              Apply to Code
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-gray-500">
                        {isOptimizing ? 'Running sweep simulations across parameters...' : 'Click "Run Parameter Sweep" to view ranked optimization configurations.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
