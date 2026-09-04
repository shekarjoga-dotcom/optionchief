import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { BACKEND_URL } from '../config';
import { 
  Code2, Play, CheckCircle2, AlertTriangle, RefreshCw, Save, 
  Sliders, Activity, Zap, HelpCircle, FileCode, Check,
  Trash2, FolderHeart, X
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, ReferenceLine 
} from 'recharts';

interface Preset {
  id: string;
  name: string;
  description: string;
  symbol?: string;
  timeframe: string;
  moneyness: string;
  tp_pct: number;
  sl_pct: number;
  code: string;
}

interface SavedStrategy {
  id: string;
  name: string;
  description?: string;
  code: string;
  symbol: string;
  timeframe: string;
  moneyness: string;
  lot_size: number;
  tp_pct: number;
  sl_pct: number;
  created_at?: string;
  updated_at?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string | null;
  indicators: Array<{ type: string; params: any; raw: string }>;
  buyCeExpr?: string;
  buyPeExpr?: string;
  recentTriggers?: number;
  sampleSignals?: any[];
  vwapWarning?: string | null;
}

const LOCAL_STORAGE_SAVED_KEY = 'options_oracle_custom_strategies';

const SYMBOL_OPTIONS = [
  {
    group: 'Spot Indices',
    items: [
      { value: 'BANKNIFTY', label: 'BANKNIFTY' },
      { value: 'NIFTY', label: 'NIFTY 50' },
      { value: 'FINNIFTY', label: 'FINNIFTY' },
      { value: 'SENSEX', label: 'SENSEX' },
      { value: 'MIDCPNIFTY', label: 'MIDCPNIFTY' },
    ]
  },
  {
    group: 'High-Volume F&O Stocks (VWAP Volume Enabled)',
    items: [
      { value: 'RELIANCE', label: 'RELIANCE (Real Volume)' },
      { value: 'HDFCBANK', label: 'HDFCBANK (Real Volume)' },
      { value: 'ICICIBANK', label: 'ICICIBANK (Real Volume)' },
      { value: 'SBIN', label: 'SBIN (Real Volume)' },
      { value: 'TCS', label: 'TCS (Real Volume)' },
      { value: 'INFY', label: 'INFY (Real Volume)' },
      { value: 'TATAMOTORS', label: 'TATAMOTORS (Real Volume)' },
    ]
  }
];

export default function CustomStrategyStudio() {
  const { token } = useStore();

  // Sub-tabs
  const [subTab, setSubTab] = useState<'editor' | 'scanner' | 'backtest' | 'optimizer'>('editor');

  // Strategy configuration state
  const [strategyName, setStrategyName] = useState<string>("My Custom Strategy");
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

  // Saved custom strategies state
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string>("");
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [saveModalName, setSaveModalName] = useState<string>("");
  const [saveModalDesc, setSaveModalDesc] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sorting state for all 3 tables
  const [scannerSort, setScannerSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'triggerTime',
    direction: 'desc'
  });
  const [tradeSort, setTradeSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'tradeId',
    direction: 'asc'
  });
  const [optSort, setOptSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'rank',
    direction: 'asc'
  });

  // Scanner state
  const [scanSymbols, setScanSymbols] = useState<string[]>(["BANKNIFTY", "NIFTY", "FINNIFTY", "SENSEX", "RELIANCE", "HDFCBANK"]);
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

  // 1. Load Presets & Saved Strategies on Mount
  useEffect(() => {
    fetchPresets();
    fetchSavedStrategies();
  }, [token]);

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

  const fetchSavedStrategies = async () => {
    let localList: SavedStrategy[] = [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SAVED_KEY);
      if (raw) {
        localList = JSON.parse(raw);
      }
    } catch (e) {
      console.error("Failed to parse local saved strategies:", e);
    }

    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/custom-strategy/saved`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const serverList = await res.json();
          const mergedMap = new Map<string, SavedStrategy>();
          serverList.forEach((s: SavedStrategy) => mergedMap.set(s.id, s));
          localList.forEach((s: SavedStrategy) => {
            if (!mergedMap.has(s.id)) mergedMap.set(s.id, s);
          });
          const merged = Array.from(mergedMap.values());
          setSavedStrategies(merged);
          localStorage.setItem(LOCAL_STORAGE_SAVED_KEY, JSON.stringify(merged));
          return;
        }
      } catch (e) {
        console.warn("Could not sync saved strategies with backend, using local copy", e);
      }
    }
    setSavedStrategies(localList);
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setSelectedSavedId(""); // clear custom saved selection
    const p = presets.find(x => x.id === presetId);
    if (p) {
      setStrategyName(p.name);
      setCode(p.code);
      if (p.symbol) setSymbol(p.symbol);
      setTimeframe(p.timeframe);
      setMoneyness(p.moneyness);
      setTpPct(p.tp_pct);
      setSlPct(p.sl_pct);
      setValidation(null);
    }
  };

  const handleSelectSavedStrategy = (savedId: string) => {
    setSelectedSavedId(savedId);
    setSelectedPresetId(""); // clear preset selection
    const strat = savedStrategies.find(s => s.id === savedId);
    if (strat) {
      setStrategyName(strat.name);
      setCode(strat.code);
      if (strat.symbol) setSymbol(strat.symbol);
      if (strat.timeframe) setTimeframe(strat.timeframe);
      if (strat.moneyness) setMoneyness(strat.moneyness);
      if (strat.lot_size) setLotSize(strat.lot_size);
      if (strat.tp_pct !== undefined) setTpPct(strat.tp_pct);
      if (strat.sl_pct !== undefined) setSlPct(strat.sl_pct);
      setValidation(null);
    }
  };

  const handleOpenSaveModal = () => {
    setSaveModalName(strategyName || "My Custom Strategy");
    const existing = savedStrategies.find(s => s.id === selectedSavedId);
    setSaveModalDesc(existing?.description || "");
    setShowSaveModal(true);
  };

  const handleSaveCustomStrategy = async (asNew: boolean = false) => {
    setIsSaving(true);
    const stratId = (!asNew && selectedSavedId) ? selectedSavedId : `strat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const finalName = saveModalName.trim() || strategyName.trim() || "My Custom Strategy";
    const strategyData: SavedStrategy = {
      id: stratId,
      name: finalName,
      description: saveModalDesc.trim(),
      code,
      symbol,
      timeframe,
      moneyness,
      lot_size: lotSize,
      tp_pct: tpPct,
      sl_pct: slPct,
      updated_at: new Date().toISOString()
    };

    // 1. Always update local storage
    const updatedList = [strategyData, ...savedStrategies.filter(s => s.id !== stratId)];
    setSavedStrategies(updatedList);
    localStorage.setItem(LOCAL_STORAGE_SAVED_KEY, JSON.stringify(updatedList));
    setStrategyName(finalName);
    setSelectedSavedId(stratId);

    // 2. If token present, sync to backend
    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/custom-strategy/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            id: stratId,
            name: strategyData.name,
            description: strategyData.description,
            code: strategyData.code,
            symbol: strategyData.symbol,
            timeframe: strategyData.timeframe,
            moneyness: strategyData.moneyness,
            lot_size: strategyData.lot_size,
            tp_pct: strategyData.tp_pct,
            sl_pct: strategyData.sl_pct
          })
        });
      } catch (e) {
        console.warn("Saved to local storage, backend sync failed:", e);
      }
    }

    setIsSaving(false);
    setShowSaveModal(false);
    setSaveSuccessMsg(`Strategy "${finalName}" saved!`);
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };

  const handleDeleteSavedStrategy = async (idToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const strat = savedStrategies.find(s => s.id === idToDelete);
    const name = strat?.name || "this strategy";
    if (!window.confirm(`Are you sure you want to delete "${name}" from your custom strategies?`)) return;

    const nextList = savedStrategies.filter(s => s.id !== idToDelete);
    setSavedStrategies(nextList);
    localStorage.setItem(LOCAL_STORAGE_SAVED_KEY, JSON.stringify(nextList));

    if (selectedSavedId === idToDelete) {
      setSelectedSavedId("");
    }

    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/custom-strategy/saved/${idToDelete}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn("Failed to delete strategy on backend:", err);
      }
    }
  };

  // Sorting handlers & memoized sorted arrays
  const handleScannerSort = (field: string) => {
    setScannerSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleTradeSort = (field: string) => {
    setTradeSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleOptSort = (field: string) => {
    setOptSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedScanResults = useMemo(() => {
    return [...scanResults].sort((a, b) => {
      const { field, direction } = scannerSort;
      let valA = a[field];
      let valB = b[field];
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';
      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [scanResults, scannerSort]);

  const sortedTrades = useMemo(() => {
    const trades = backtestResults?.trades || [];
    return [...trades].sort((a, b) => {
      const { field, direction } = tradeSort;
      let valA = a[field];
      let valB = b[field];
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';
      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [backtestResults, tradeSort]);

  const sortedOptResults = useMemo(() => {
    const mapped = optResults.map((row, idx) => ({
      ...row,
      rank: idx + 1,
      moneyness: row.parameters?.moneyness || '',
      takeProfitPct: row.parameters?.takeProfitPct ?? 0,
      stopLossPct: row.parameters?.stopLossPct ?? 0,
      netPnL: row.metrics?.netPnL ?? 0,
      netReturnPct: row.metrics?.netReturnPct ?? 0,
      winRate: row.metrics?.winRate ?? 0,
      profitFactor: typeof row.metrics?.profitFactor === 'number' ? row.metrics.profitFactor : 0,
      maxDrawdown: row.metrics?.maxDrawdown ?? 0,
    }));

    return mapped.sort((a, b) => {
      const { field, direction } = optSort;
      let valA = (a as any)[field];
      let valB = (b as any)[field];
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';
      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [optResults, optSort]);

  const renderSortHeader = (
    label: string,
    field: string,
    currentSort: { field: string; direction: 'asc' | 'desc' },
    onSort: (field: string) => void,
    align: 'left' | 'right' | 'center' = 'left',
    extraClass: string = ''
  ) => {
    const isActive = currentSort.field === field;
    return (
      <th
        onClick={() => onSort(field)}
        className={`p-3.5 cursor-pointer select-none group transition-colors hover:text-white ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${extraClass}`}
        title={`Click to sort by ${label}`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          <span className={`text-[11px] font-mono transition-all ${isActive ? 'text-accentBrand font-black opacity-100' : 'text-gray-600 opacity-40 group-hover:opacity-100'}`}>
            {isActive ? (currentSort.direction === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </div>
      </th>
    );
  };

  // VWAP & Index detection
  const isVwapUsed = /\bvwap\b/i.test(code) || (validation?.indicators?.some(ind => ind.type?.toLowerCase() === 'vwap') ?? false);
  const isIndexSymbol = ['BANKNIFTY', 'NIFTY', 'FINNIFTY', 'SENSEX', 'MIDCPNIFTY'].includes(symbol.toUpperCase());
  const isVwapOnIndex = isVwapUsed && isIndexSymbol;


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
              <div className="flex-1 min-w-[200px]">
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

              {/* Template Presets */}
              <div className="min-w-[190px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Load Template Preset
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-amber-300 font-semibold focus:outline-none focus:border-accentBrand"
                >
                  <option value="">-- Built-in Presets --</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* My Saved Custom Strategies Library */}
              <div className="min-w-[220px]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1">
                    <FolderHeart className="w-3 h-3" />
                    <span>My Saved Strategies ({savedStrategies.length})</span>
                  </label>
                  {selectedSavedId && (
                    <button
                      onClick={(e) => handleDeleteSavedStrategy(selectedSavedId, e)}
                      title="Delete this saved strategy"
                      className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5 transition-colors"
                    >
                      <Trash2 className="w-2.5 h-2.5" /> Delete
                    </button>
                  )}
                </div>
                <select
                  value={selectedSavedId}
                  onChange={(e) => handleSelectSavedStrategy(e.target.value)}
                  className="w-full bg-black/40 border border-pink-500/30 rounded-lg px-3 py-1.5 text-xs text-pink-300 font-semibold focus:outline-none focus:border-pink-500"
                >
                  <option value="">-- {savedStrategies.length > 0 ? "Select Saved Strategy" : "No saved strategies yet"} --</option>
                  {savedStrategies.map((s) => (
                    <option key={s.id} value={s.id}>
                      ★ {s.name} ({s.symbol || 'BANKNIFTY'} {s.timeframe || '5m'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Save / Update Strategy Button */}
              <div className="flex items-end gap-2">
                <button
                  onClick={handleOpenSaveModal}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accentBrand hover:bg-accentBrand/90 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                  title="Save or update custom strategy"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{selectedSavedId ? "Update / Save As" : "Save Strategy"}</span>
                </button>
                {saveSuccessMsg && (
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                    <Check className="w-3 h-3" /> {saveSuccessMsg}
                  </span>
                )}
              </div>
            </div>

            {/* VWAP on Index Warning Banner */}
            {isVwapOnIndex && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3 shadow-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-amber-200 flex items-center gap-2">
                    <span>VWAP Traded Volume Notice</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                      {symbol} is a Spot Index
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-300/80 mt-1 leading-relaxed">
                    Spot indices (<strong>{symbol}</strong>, NIFTY, BANKNIFTY) do not have exchange-traded volume in spot cash feeds. 
                    VWAP calculates as an intraday cumulative typical price average proxy. For true institutional volume-weighted VWAP, 
                    select high-volume F&O equity stocks or trade index futures contracts.
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-[10px] font-bold text-gray-400">Switch to Volume Stock:</span>
                    <button
                      onClick={() => setSymbol('RELIANCE')}
                      className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold transition-all"
                    >
                      RELIANCE
                    </button>
                    <button
                      onClick={() => setSymbol('HDFCBANK')}
                      className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold transition-all"
                    >
                      HDFCBANK
                    </button>
                    <button
                      onClick={() => setSymbol('SBIN')}
                      className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold transition-all"
                    >
                      SBIN
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">
                    Index / Underlying
                    {isVwapOnIndex && (
                      <span className="ml-1 text-[9px] text-amber-400 font-normal">⚠️ Spot (No Vol)</span>
                    )}
                  </label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-accentBrand"
                  >
                    {SYMBOL_OPTIONS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.items.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    ))}
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
                    {renderSortHeader('Symbol', 'symbol', scannerSort, handleScannerSort)}
                    {renderSortHeader('Signal', 'direction', scannerSort, handleScannerSort)}
                    {renderSortHeader('Trigger Time', 'triggerTime', scannerSort, handleScannerSort)}
                    {renderSortHeader('Spot Price', 'spotPrice', scannerSort, handleScannerSort)}
                    {renderSortHeader('Target Option Contract', 'contractName', scannerSort, handleScannerSort, 'left', 'text-cyan-400')}
                    {renderSortHeader('Est. Premium', 'estimatedPremium', scannerSort, handleScannerSort)}
                    {renderSortHeader('Lot Size', 'lotSize', scannerSort, handleScannerSort)}
                    <th className="p-3.5">Key Indicators</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderClr/30">
                  {sortedScanResults.length > 0 ? (
                    sortedScanResults.map((sig, idx) => {
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
                <label className="text-[10px] font-bold text-gray-400 block mb-1">
                  Underlying Instrument
                  {isVwapOnIndex && (
                    <span className="ml-1 text-[9px] text-amber-400 font-normal">⚠️ Spot Proxy</span>
                  )}
                </label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-white font-bold"
                >
                  {SYMBOL_OPTIONS.map((grp) => (
                    <optgroup key={grp.group} label={grp.group}>
                      {grp.items.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
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
                  <span className="text-xs text-gray-500">Click headers to sort trades • Intraday Black-Scholes Model</span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-black/80 z-10 border-b border-borderClr text-gray-400 uppercase font-bold text-[10px]">
                      <tr>
                        {renderSortHeader('#', 'tradeId', tradeSort, handleTradeSort)}
                        {renderSortHeader('Direction', 'direction', tradeSort, handleTradeSort)}
                        {renderSortHeader('Entry Time', 'entryDate', tradeSort, handleTradeSort)}
                        {renderSortHeader('Exit Time', 'exitDate', tradeSort, handleTradeSort)}
                        {renderSortHeader('Strike & Type', 'strike', tradeSort, handleTradeSort)}
                        {renderSortHeader('Entry Prem', 'entryPrice', tradeSort, handleTradeSort)}
                        {renderSortHeader('Exit Prem', 'exitPrice', tradeSort, handleTradeSort)}
                        {renderSortHeader('Exit Reason', 'exitReason', tradeSort, handleTradeSort)}
                        {renderSortHeader('Duration', 'duration', tradeSort, handleTradeSort)}
                        {renderSortHeader('Net PnL (₹)', 'netPnL', tradeSort, handleTradeSort, 'right')}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderClr/30">
                      {sortedTrades.map((t: any) => (
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
                    {renderSortHeader('Rank', 'rank', optSort, handleOptSort)}
                    {renderSortHeader('Moneyness', 'moneyness', optSort, handleOptSort)}
                    {renderSortHeader('Take Profit', 'takeProfitPct', optSort, handleOptSort, 'left', 'text-emerald-400')}
                    {renderSortHeader('Stop Loss', 'stopLossPct', optSort, handleOptSort, 'left', 'text-red-400')}
                    {renderSortHeader('Net Return (₹)', 'netPnL', optSort, handleOptSort, 'right')}
                    {renderSortHeader('Net Return (%)', 'netReturnPct', optSort, handleOptSort, 'right')}
                    {renderSortHeader('Win Rate', 'winRate', optSort, handleOptSort, 'right')}
                    {renderSortHeader('Profit Factor', 'profitFactor', optSort, handleOptSort, 'right')}
                    {renderSortHeader('Max DD', 'maxDrawdown', optSort, handleOptSort, 'right')}
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderClr/30">
                  {sortedOptResults.length > 0 ? (
                    sortedOptResults.map((row, idx) => {
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

      {/* SAVE STRATEGY MODAL */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111827] border border-borderClr rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-borderClr/60 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <FolderHeart className="w-5 h-5 text-pink-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Save Custom Strategy
                </h3>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                  Strategy Name *
                </label>
                <input
                  type="text"
                  value={saveModalName}
                  onChange={(e) => setSaveModalName(e.target.value)}
                  placeholder="e.g., 5m High-Momentum VWAP Breakout"
                  className="w-full bg-black/50 border border-borderClr rounded-xl px-3.5 py-2 text-white font-bold focus:outline-none focus:border-accentBrand"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                  Description / Strategy Notes (Optional)
                </label>
                <textarea
                  value={saveModalDesc}
                  onChange={(e) => setSaveModalDesc(e.target.value)}
                  rows={3}
                  placeholder="e.g., Runs on Reliance with RSI confirmation and 25% TP."
                  className="w-full bg-black/50 border border-borderClr rounded-xl p-3 text-gray-300 focus:outline-none focus:border-accentBrand resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-borderClr/60 grid grid-cols-3 gap-2 font-mono text-[11px]">
                <div>
                  <span className="text-gray-500 block text-[9px]">SYMBOL</span>
                  <span className="text-white font-bold">{symbol}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">TIMEFRAME</span>
                  <span className="text-white font-bold">{timeframe}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">MONEYNESS</span>
                  <span className="text-cyan-300 font-bold">{moneyness}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">TAKE PROFIT</span>
                  <span className="text-emerald-400 font-bold">+{tpPct}%</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">STOP LOSS</span>
                  <span className="text-red-400 font-bold">-{slPct}%</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">LOTS</span>
                  <span className="text-white font-bold">{lotSize}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-borderClr/60 bg-black/40 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                {selectedSavedId && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveCustomStrategy(true)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-borderClr rounded-xl text-xs font-bold transition-all"
                  >
                    Save As New
                  </button>
                )}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveCustomStrategy(false)}
                  className="flex items-center gap-2 px-5 py-2 bg-accentBrand hover:bg-accentBrand/90 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Saving..." : selectedSavedId ? "Update Strategy" : "Save Strategy"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

