import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { BACKEND_URL } from '../config';
import { getNextWeeklyExpiry } from '../utils/optionsMath';
import { 
  Code2, Play, CheckCircle2, AlertTriangle, RefreshCw, Save, 
  Sliders, Activity, Zap, HelpCircle, FileCode, Check,
  Trash2, FolderHeart, X, ShieldCheck, TrendingUp, 
  ArrowUpRight, Scale, Clock, ShieldAlert, Briefcase,
  Copy, Layers
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
  const { token, fetchPortfolios, selectedExpiry, expiryDates } = useStore();

  // Sub-tabs
  const [subTab, setSubTab] = useState<'editor' | 'scanner' | 'backtest' | 'optimizer' | 'quant_read'>('editor');

  // AI Quant Read & NIFTYBEES state
  const [quantSymbol, setQuantSymbol] = useState<'NIFTY' | 'BANKNIFTY'>('NIFTY');
  const [quantData, setQuantData] = useState<any | null>(null);
  const [isQuantLoading, setIsQuantLoading] = useState<boolean>(false);
  const [quantError, setQuantError] = useState<string | null>(null);

  // Paper Trade & Live Execution Modal state
  const [orderModalData, setOrderModalData] = useState<{
    isOpen: boolean;
    type: 'ETF' | 'SPREAD' | 'OPTION';
    broker: 'paper' | 'dhan';
    name: string;
    symbol: string;
    description: string;
    qty: number;
    lotSize: number;
    legs: any[];
    margin: number;
    maxProfit: string;
    maxLoss: string;
    invalidation: string;
  } | null>(null);

  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [orderSuccessBanner, setOrderSuccessBanner] = useState<{
    show: boolean;
    title: string;
    message: string;
    portfolioId?: string;
  } | null>(null);

  // Quant & Selling Report modal state
  const [showRawMarkdown, setShowRawMarkdown] = useState<boolean>(false);
  const [activeReportTab, setActiveReportTab] = useState<'v14_selling' | 'v6_niftybees'>('v14_selling');
  const [copiedRawReport, setCopiedRawReport] = useState<boolean>(false);

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

  const fetchQuantRead = async (sym: 'NIFTY' | 'BANKNIFTY' = quantSymbol) => {
    setIsQuantLoading(true);
    setQuantError(null);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/custom-strategy/quant-read?symbol=${sym}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) {
        throw new Error(`Quant read request failed with status ${resp.status}`);
      }
      const data = await resp.json();
      setQuantData(data);
    } catch (err: any) {
      setQuantError(err.message || 'Failed to fetch quant read.');
    } finally {
      setIsQuantLoading(false);
    }
  };

  // Paper Trade & Live Execution Handlers for Quant Hub
  const handleOpenEtfOrder = () => {
    if (!quantData) return;
    const cmp = quantData.niftybees_track?.cmp || 273.40;
    const defaultQty = 100;
    const totalVal = Math.round(cmp * defaultQty);
    
    setOrderModalData({
      isOpen: true,
      type: 'ETF',
      broker: 'paper',
      name: 'NIFTYBEES Intraday Accumulation',
      symbol: 'NIFTYBEES',
      description: `Support Buy Zone: ${quantData.niftybees_track?.buy_zone_str} (Zero Time Decay)`,
      qty: defaultQty,
      lotSize: 1,
      margin: totalVal,
      maxProfit: `Target Zone: ${quantData.niftybees_track?.target_zone_str}`,
      maxLoss: quantData.niftybees_track?.invalidation_str || 'Exit on support breakdown',
      invalidation: quantData.niftybees_track?.invalidation_str || '',
      legs: [
        {
          id: `bees_${Date.now()}`,
          strike: 0.0,
          optionType: 'F',
          expiry: 'INTRADAY',
          action: 'BUY',
          quantity: defaultQty,
          entryPrice: cmp,
          currentPrice: cmp,
          iv: 0.0
        }
      ]
    });
  };

  const handleOpenSpreadOrder = () => {
    if (!quantData) return;
    const spread = quantData.defined_risk_spread;
    const sym = quantData.symbol || 'NIFTY';
    const lotMultiplier = spread.lot_size || (sym === 'NIFTY' ? 25 : 15);
    const optType = spread.option_type || (spread.spread_type?.includes('Call') ? 'C' : 'P');
    const shortStrike = spread.short_strike || quantData.walls?.put_wall_strike || 23800;
    const longStrike = spread.long_strike || (shortStrike - (sym === 'NIFTY' ? 100 : 200));
    const shortPrem = spread.short_premium || 55.0;
    const longPrem = spread.long_premium || 19.0;
    const netCredit = spread.net_credit_pts || (shortPrem - longPrem);
    const maxProf = spread.max_profit_lot || (netCredit * lotMultiplier);
    const maxRisk = spread.max_risk_lot || ((Math.abs(shortStrike - longStrike) - netCredit) * lotMultiplier);
    const spreadMargin = spread.spread_margin || 28500;
    const expiryDate = spread.expiry || selectedExpiry || (expiryDates && expiryDates.length > 0 ? expiryDates[0] : getNextWeeklyExpiry(sym));

    setOrderModalData({
      isOpen: true,
      type: 'SPREAD',
      broker: 'paper',
      name: `${sym} ${spread.spread_type}`,
      symbol: sym,
      description: `Net Credit: +${netCredit} pts | Margin ~₹${spreadMargin.toLocaleString()} | Exp: ${expiryDate}`,
      qty: 1, // 1 lot
      lotSize: lotMultiplier,
      margin: spreadMargin,
      maxProfit: `+₹${maxProf.toLocaleString()} (${netCredit} pts credit)`,
      maxLoss: `-₹${maxRisk.toLocaleString()} (Capped Risk)`,
      invalidation: quantData.action_plan?.invalidation || '',
      legs: [
        {
          id: `leg_${Date.now()}_short`,
          strike: shortStrike,
          optionType: optType,
          expiry: expiryDate,
          action: 'SELL',
          quantity: lotMultiplier,
          entryPrice: shortPrem,
          currentPrice: shortPrem,
          iv: 0.145
        },
        {
          id: `leg_${Date.now()}_long`,
          strike: longStrike,
          optionType: optType,
          expiry: expiryDate,
          action: 'BUY',
          quantity: lotMultiplier,
          entryPrice: longPrem,
          currentPrice: longPrem,
          iv: 0.150
        }
      ]
    });
  };

  const handleConfirmOrder = async () => {
    if (!orderModalData) return;
    setIsSubmittingOrder(true);
    try {
      const multiplier = orderModalData.type === 'ETF' ? 1 : (orderModalData.qty || 1);
      const updatedLegs = orderModalData.legs.map(l => ({
        ...l,
        quantity: orderModalData.type === 'ETF' ? orderModalData.qty : (orderModalData.lotSize * multiplier)
      }));

      const response = await fetch(`${BACKEND_URL}/api/portfolio/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          broker: orderModalData.broker,
          name: orderModalData.name,
          symbol: orderModalData.symbol,
          description: orderModalData.description,
          legs: updatedLegs
        })
      });

      const resData = await response.json();
      if (response.ok && resData.status === 'success') {
        // Immediate local store registration so the trade appears in Paper Trade Book without delay
        const newPortfolioObj = {
          id: resData.portfolio_id || `port_${Date.now()}`,
          name: `${orderModalData.broker === 'paper' ? 'Paper:' : orderModalData.broker === 'dhan' ? 'Live (Dhan):' : 'Live (Kotak):'} ${orderModalData.name}`,
          symbol: orderModalData.symbol,
          description: orderModalData.description,
          legs: updatedLegs,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          marginDeployed: orderModalData.margin,
          realizedPnL: 0.0,
          entrySpot: quantData?.spot || 0.0,
          peakProfit: 0.0,
          maxDrawdown: 0.0,
          takeProfit: 20.0,
          stopLoss: 0.0
        };
        const currentPorts = useStore.getState().portfolios;
        if (!currentPorts.some(p => p.id === newPortfolioObj.id)) {
          const updatedPorts = [newPortfolioObj as any, ...currentPorts];
          useStore.setState({ portfolios: updatedPorts });
          const userPhone = useStore.getState().user?.phone_number || "guest";
          try {
            localStorage.setItem(`options_oracle_portfolios_${userPhone}`, JSON.stringify(updatedPorts));
          } catch (e) {}
        }

        await fetchPortfolios();
        const placedBroker = orderModalData.broker.toUpperCase();
        setOrderModalData(null);
        setOrderSuccessBanner({
          show: true,
          title: `Trade Executed in ${placedBroker} Trade Book!`,
          message: `Successfully booked "${orderModalData.name}" with ${updatedLegs.length} leg(s). You can monitor live Greeks, margin and P&L in the Paper Portfolio Book.`,
          portfolioId: resData.portfolio_id
        });
      } else {
        alert(`Order Execution Error: ${resData.detail || 'Failed to place order.'}`);
      }
    } catch (err: any) {
      alert(`Order submission error: ${err.message || err}`);
    } finally {
      setIsSubmittingOrder(false);
    }
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
          <button
            onClick={() => {
              setSubTab('quant_read');
              if (!quantData) fetchQuantRead(quantSymbol);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'quant_read'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-purple-300 hover:text-white hover:bg-purple-500/10'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>5. 🧠 AI Quant Read & NIFTYBEES</span>
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
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Execution Instrument / Strike</label>
                  <select
                    value={moneyness}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMoneyness(val);
                      if (val === 'NIFTYBEES' || val === 'BANKBEES' || val === 'ETF') {
                        if (tpPct >= 10) setTpPct(2.0);
                        if (slPct >= 5) setSlPct(0.8);
                      }
                    }}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-accentBrand"
                  >
                    <optgroup label="Index ETFs (Zero Time Decay - High Win-Rate)">
                      <option value="NIFTYBEES">NIFTYBEES (Nifty 50 ETF)</option>
                      <option value="BANKBEES">BANKBEES (BankNifty ETF)</option>
                    </optgroup>
                    <optgroup label="Index Options (Delta Leverage - Time Decay)">
                      <option value="ATM">ATM (At The Money)</option>
                      <option value="OTM1">OTM 1 (1 Strike Out)</option>
                      <option value="OTM2">OTM 2 (2 Strikes Out)</option>
                      <option value="ITM">ITM (1 Strike In)</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">
                    {moneyness === 'NIFTYBEES' || moneyness === 'BANKBEES' || moneyness === 'ETF' ? 'Position Lots (×100 Sh)' : 'Lot Size'}
                  </label>
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
                    step={moneyness === 'NIFTYBEES' || moneyness === 'BANKBEES' || moneyness === 'ETF' ? 0.1 : 1}
                    onChange={(e) => setTpPct(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-accentBrand"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-red-400 block mb-1">Stop Loss (%)</label>
                  <input
                    type="number"
                    value={slPct}
                    step={moneyness === 'NIFTYBEES' || moneyness === 'BANKBEES' || moneyness === 'ETF' ? 0.1 : 1}
                    onChange={(e) => setSlPct(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/40 border border-borderClr rounded-lg px-2.5 py-1.5 text-xs text-red-400 font-bold focus:outline-none focus:border-accentBrand"
                  />
                </div>
              </div>

              {(moneyness === 'NIFTYBEES' || moneyness === 'BANKBEES' || moneyness === 'ETF') && (
                <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-[11px] text-emerald-300">
                  <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 mt-0.5">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold mb-0.5">
                      ⚡ ZERO THETA DECAY ACTIVE ({moneyness === 'BANKBEES' ? 'BANKBEES' : 'NIFTYBEES'} Mode)
                    </strong>
                    Strategy scans <strong>{symbol}</strong> Index spot candles for signals, but executes directly in <strong>{moneyness === 'BANKBEES' ? 'BANKBEES' : 'NIFTYBEES'}</strong> ETF shares. Eliminates 100% of expiry theta erosion and Greeks volatility drag!
                  </div>
                </div>
              )}
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
                    {renderSortHeader('Instrument / Strike', 'contractName', scannerSort, handleScannerSort, 'left', 'text-cyan-400')}
                    {renderSortHeader('Est. Price / Prem', 'estimatedPremium', scannerSort, handleScannerSort)}
                    {renderSortHeader('Units / Lot', 'lotSize', scannerSort, handleScannerSort)}
                    <th className="p-3.5">Key Indicators</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderClr/30">
                  {sortedScanResults.length > 0 ? (
                    sortedScanResults.map((sig, idx) => {
                      const isCe = sig.direction === 'BULLISH_CE';
                      const isEtf = sig.isEtf || sig.optionType === 'ETF';
                      return (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3.5 font-bold text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{sig.symbol}</span>
                              {isEtf && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  ETF
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 font-bold">
                            <span className={`px-2 py-1 rounded-md text-[11px] font-extrabold border ${
                              isEtf
                                ? (isCe ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30')
                                : (isCe ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-pink-500/15 text-pink-400 border-pink-500/30')
                            }`}>
                              {isEtf ? (isCe ? 'BUY ETF' : 'EXIT/HEDGE ETF') : (isCe ? 'BUY CALL (CE)' : 'BUY PUT (PE)')}
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
                          <td className="p-3.5 text-gray-400 font-mono">
                            {sig.lotSize} {isEtf ? 'shares' : 'qty'}
                          </td>
                          <td className="p-3.5 text-gray-300 font-mono text-[11px]">
                            {Object.entries(sig.indicators || {}).map(([k, v]) => (
                              <span key={k} className="mr-2 px-1.5 py-0.5 rounded bg-black/40 border border-borderClr text-gray-300 text-[10px]">
                                {k}: <strong className="text-white">{String(v)}</strong>
                              </span>
                            ))}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => {
                                const activeStratName = (selectedSavedId && savedStrategies.find(s => s.id === selectedSavedId)?.name)
                                  || (selectedPresetId && presets.find(p => p.id === selectedPresetId)?.name)
                                  || 'Index Scanner';

                                if (isEtf) {
                                  const etfSym = sig.etfSymbol || (sig.symbol === 'BANKNIFTY' ? 'BANKBEES' : 'NIFTYBEES');
                                  const defaultQty = (sig.lotSize && sig.lotSize > 0) ? sig.lotSize : 100;
                                  const totalVal = Math.round(sig.estimatedPremium * defaultQty);
                                  setOrderModalData({
                                    isOpen: true,
                                    type: 'ETF',
                                    broker: 'paper',
                                    name: `${etfSym} Index Trend Entry`,
                                    symbol: etfSym,
                                    description: `Strategy: ${activeStratName} on ${sig.symbol} @ ₹${sig.spotPrice} (Zero Time Decay ETF)`,
                                    qty: defaultQty,
                                    lotSize: 1,
                                    margin: totalVal,
                                    maxProfit: `Target: +${tpPct}% (~₹${Math.round(totalVal * (tpPct / 100))})`,
                                    maxLoss: `Stop Loss: -${slPct}% (~₹${Math.round(totalVal * (slPct / 100))})`,
                                    invalidation: `Exit if spot breaches -${slPct}% or opposite reversal candle`,
                                    legs: [
                                      {
                                        id: `bees_${Date.now()}`,
                                        strike: 0.0,
                                        optionType: 'F',
                                        expiry: 'INTRADAY',
                                        action: 'BUY',
                                        quantity: defaultQty,
                                        entryPrice: sig.estimatedPremium,
                                        currentPrice: sig.estimatedPremium,
                                        iv: 0.0
                                      }
                                    ]
                                  });
                                } else {
                                  const lotMultiplier = sig.lotSize || 25;
                                  const contractCost = Math.round(sig.estimatedPremium * lotMultiplier);
                                  setOrderModalData({
                                    isOpen: true,
                                    type: 'OPTION',
                                    broker: 'paper',
                                    name: `${sig.contractName} Breakout Entry`,
                                    symbol: sig.symbol,
                                    description: `Strategy: ${activeStratName} on ${sig.symbol} @ ₹${sig.spotPrice}`,
                                    qty: 1,
                                    lotSize: lotMultiplier,
                                    margin: contractCost,
                                    maxProfit: `Target: +${tpPct}% (~₹${Math.round(contractCost * (tpPct / 100))})`,
                                    maxLoss: `Stop Loss: -${slPct}% (~₹${Math.round(contractCost * (slPct / 100))})`,
                                    invalidation: `Option stop loss at -${slPct}%`,
                                    legs: [
                                      {
                                        id: `opt_${Date.now()}`,
                                        strike: sig.strike,
                                        optionType: sig.optionType,
                                        expiry: 'WEEKLY',
                                        action: 'BUY',
                                        quantity: lotMultiplier,
                                        entryPrice: sig.estimatedPremium,
                                        currentPrice: sig.estimatedPremium,
                                        iv: 0.15
                                      }
                                    ]
                                  });
                                }
                              }}
                              className={`px-3 py-1 text-white text-[11px] font-bold rounded-md transition-all shadow ${
                                isEtf 
                                  ? 'bg-emerald-600 hover:bg-emerald-500' 
                                  : 'bg-accentBrand hover:bg-accentBrand/90'
                              }`}
                            >
                              {isEtf ? 'Paper Trade ETF' : 'Paper Trade'}
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

              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">
                  Execution Instrument
                  {(moneyness === 'NIFTYBEES' || moneyness === 'BANKBEES' || moneyness === 'ETF') && (
                    <span className="ml-1 text-[9px] text-emerald-400 font-bold">⚡ Zero Decay</span>
                  )}
                </label>
                <select
                  value={moneyness}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMoneyness(val);
                    if (val === 'NIFTYBEES' || val === 'BANKBEES' || val === 'ETF') {
                      if (tpPct >= 10) setTpPct(2.0);
                      if (slPct >= 5) setSlPct(0.8);
                    }
                  }}
                  className="bg-black/40 border border-borderClr rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-bold"
                >
                  <optgroup label="Index ETFs (Zero Time Decay)">
                    <option value="NIFTYBEES">NIFTYBEES ETF</option>
                    <option value="BANKBEES">BANKBEES ETF</option>
                  </optgroup>
                  <optgroup label="Index Options (Greeks / Decay)">
                    <option value="ATM">ATM Options</option>
                    <option value="OTM1">OTM 1 Strike</option>
                    <option value="OTM2">OTM 2 Strikes</option>
                    <option value="ITM">ITM 1 Strike</option>
                  </optgroup>
                </select>
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
                  <span className="text-xs text-gray-500">
                    Click headers to sort trades • {moneyness.includes('BEES') || moneyness === 'ETF' ? 'Direct ETF Spot Tracking (Zero Time Decay)' : 'Intraday Black-Scholes Model'}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-black/80 z-10 border-b border-borderClr text-gray-400 uppercase font-bold text-[10px]">
                      <tr>
                        {renderSortHeader('#', 'tradeId', tradeSort, handleTradeSort)}
                        {renderSortHeader('Direction', 'direction', tradeSort, handleTradeSort)}
                        {renderSortHeader('Entry Time', 'entryDate', tradeSort, handleTradeSort)}
                        {renderSortHeader('Exit Time', 'exitDate', tradeSort, handleTradeSort)}
                        {renderSortHeader('Instrument / Strike', 'strike', tradeSort, handleTradeSort)}
                        {renderSortHeader('Entry Price', 'entryPrice', tradeSort, handleTradeSort)}
                        {renderSortHeader('Exit Price', 'exitPrice', tradeSort, handleTradeSort)}
                        {renderSortHeader('Exit Reason', 'exitReason', tradeSort, handleTradeSort)}
                        {renderSortHeader('Duration', 'duration', tradeSort, handleTradeSort)}
                        {renderSortHeader('Net PnL (₹)', 'netPnL', tradeSort, handleTradeSort, 'right')}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderClr/30">
                      {sortedTrades.map((t: any) => {
                        const isEtf = t.optionType === 'ETF' || String(t.strike).includes('BEES');
                        return (
                          <tr key={t.tradeId} className="hover:bg-white/5 font-mono">
                            <td className="p-3 text-gray-400">{t.tradeId}</td>
                            <td className="p-3 font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isEtf
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : (t.direction === 'BULLISH_CE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-pink-500/20 text-pink-400')
                              }`}>
                                {isEtf ? 'BUY ETF' : (t.direction === 'BULLISH_CE' ? 'CE' : 'PE')}
                              </span>
                            </td>
                            <td className="p-3 text-gray-300 text-[11px]">{t.entryDate}</td>
                            <td className="p-3 text-gray-300 text-[11px]">{t.exitDate}</td>
                            <td className="p-3 font-bold text-white">
                              {isEtf ? `${t.strike}` : `${t.strike} ${t.optionType}`}
                            </td>
                            <td className="p-3">₹{t.entryPrice}</td>
                            <td className="p-3">₹{t.exitPrice}</td>
                            <td className="p-3 font-sans text-gray-400 text-[11px]">{t.exitReason}</td>
                            <td className="p-3 text-gray-400 text-[11px]">{t.duration}</td>
                            <td className={`p-3 text-right font-bold ${t.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {t.netPnL >= 0 ? `+₹${t.netPnL}` : `-₹${Math.abs(t.netPnL)}`}
                            </td>
                          </tr>
                        );
                      })}
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
                {["NIFTYBEES", "BANKBEES", "ITM", "ATM", "OTM1", "OTM2"].map((m) => {
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

      {/* SUB-TAB 5: AI QUANT READ & NIFTYBEES HUB */}
      {subTab === 'quant_read' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          
          {/* Top Control Bar */}
          <div className="bg-cardClr border border-borderClr rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-black/50 border border-borderClr/80 rounded-xl p-1 gap-1">
                {(['NIFTY', 'BANKNIFTY'] as const).map((sym) => (
                  <button
                    key={sym}
                    onClick={() => {
                      setQuantSymbol(sym);
                      fetchQuantRead(sym);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                      quantSymbol === sym
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {sym === 'NIFTY' ? 'NIFTY 50' : 'BANKNIFTY'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchQuantRead(quantSymbol)}
                disabled={isQuantLoading}
                className="flex items-center gap-2 px-4 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-200 border border-borderClr rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isQuantLoading ? 'animate-spin text-purple-400' : 'text-gray-400'}`} />
                <span>{isQuantLoading ? 'Analyzing...' : 'Re-Analyze Structure'}</span>
              </button>
            </div>

            {quantData && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Data Quality Indicator */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-300 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>DATA QUALITY: {quantData.data_quality?.live_count || 8}/9 LIVE</span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border border-borderClr/60 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-gray-400">{quantData.market_phase}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-blue-300 font-mono font-bold">{quantData.minutes_left}m left</span>
                </div>

                <div className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl font-bold ${
                  quantData.candle_sufficiency.gate_passed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{quantData.candle_sufficiency.gate_status}</span>
                </div>

                {/* View v14 Option-Selling Report Button */}
                <button
                  onClick={() => {
                    setActiveReportTab('v14_selling');
                    setShowRawMarkdown(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/40 hover:to-indigo-600/40 text-purple-200 border border-purple-500/40 rounded-xl font-bold transition-all shadow-sm"
                >
                  <FileCode className="w-3.5 h-3.5 text-purple-400" />
                  <span>⚡ View v14 Option-Selling Report</span>
                </button>

                {/* View v6 NIFTYBEES Report Button */}
                <button
                  onClick={() => {
                    setActiveReportTab('v6_niftybees');
                    setShowRawMarkdown(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-borderClr rounded-xl font-bold transition-all shadow-sm"
                >
                  <span>📋 v6 NIFTYBEES</span>
                </button>
              </div>
            )}
          </div>

          {/* Loading State */}
          {isQuantLoading && (
            <div className="bg-cardClr/60 border border-borderClr/80 rounded-2xl p-16 flex flex-col items-center justify-center gap-4 text-center">
              <RefreshCw className="w-10 h-10 text-purple-400 animate-spin" />
              <div>
                <h3 className="text-base font-bold text-white">Running Stockan Quantitative Diagnostics...</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-md">
                  Analyzing 15:15 IST reference close, ATR gap classification, institutional option walls, 
                  and NIFTYBEES zero-decay execution zones.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {quantError && !isQuantLoading && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-red-300">Quant Diagnostic Error</h3>
              <p className="text-xs text-gray-400 mt-1">{quantError}</p>
              <button
                onClick={() => fetchQuantRead(quantSymbol)}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold rounded-xl border border-red-500/40 transition-all"
              >
                Retry Analysis
              </button>
            </div>
          )}

          {/* Quant Data Dashboard */}
          {quantData && !isQuantLoading && (
            <div className="flex flex-col gap-6">

              {/* 4-Card Overview KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Spot & Reference Close */}
                <div className="bg-cardClr border border-borderClr rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Spot & Ref Close</span>
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-md text-[10px] font-bold">
                      {quantData.gap_profile.gap_class} Gap
                    </span>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white font-mono">
                      ₹{quantData.price_action.spot.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center justify-between">
                      <span>15:15 Ref Close:</span>
                      <span className="font-mono text-gray-200">₹{quantData.price_action.reference_close_1515.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center justify-between">
                      <span>Gap Ratio:</span>
                      <span className="font-mono text-purple-300 font-bold">
                        {quantData.gap_profile.gap_points} pts ({quantData.gap_profile.gap_ratio}× ATR)
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-borderClr/60 text-[11px] text-gray-400 flex items-center justify-between">
                    <span>Opening Action:</span>
                    <span className="font-bold text-gray-200">{quantData.gap_profile.opening_behavior}</span>
                  </div>
                </div>

                {/* 2. Directional Bias & Probabilities */}
                <div className="bg-cardClr border border-borderClr rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Directional Read</span>
                    <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-md text-[10px] font-bold">
                      Conf {quantData.directional_read.confidence}/100
                    </span>
                  </div>
                  <div>
                    <div className="text-base font-black text-white">
                      {quantData.directional_read.bias}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center justify-between">
                      <span>Pressure Ratio:</span>
                      <span className="font-mono text-gray-200">{quantData.directional_read.pressure_ratio}</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono font-bold">
                      <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded">
                        ⬆ {quantData.directional_read.prob_upside}%
                      </span>
                      <span className="px-2 py-0.5 bg-red-500/15 text-red-400 rounded">
                        ⬇ {quantData.directional_read.prob_downside}%
                      </span>
                      <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 rounded">
                        ↔ {quantData.directional_read.prob_range}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-borderClr/60 text-[11px] text-gray-400 flex items-center justify-between">
                    <span>14-Period ATR:</span>
                    <span className="font-mono font-bold text-gray-200">{quantData.price_action.atr_14} pts</span>
                  </div>
                </div>

                {/* 3. Option Walls (Support & Resistance) */}
                <div className="bg-cardClr border border-borderClr rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Institutional Walls</span>
                    <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-md text-[10px] font-bold">
                      Weekly Chain
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-red-400 font-bold block text-[11px]">CALL WALL (Resistance)</span>
                        <span className="text-white font-mono font-black text-sm">{quantData.walls.call_wall_strike}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-red-500/20 text-red-300 rounded font-bold">
                        {quantData.walls.call_wall_strength}× Mean OI
                      </span>
                    </div>

                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-emerald-400 font-bold block text-[11px]">PUT WALL (Support)</span>
                        <span className="text-white font-mono font-black text-sm">{quantData.walls.put_wall_strike}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                        {quantData.walls.put_wall_strength}× Mean OI
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-borderClr/60 text-[11px] text-gray-400 flex items-center justify-between">
                    <span>Wall Stability:</span>
                    <span className="text-emerald-400 font-bold">Unwind &lt; 5% (Solid)</span>
                  </div>
                </div>

                {/* 4. Trader Action Plan */}
                <div className="bg-cardClr border border-borderClr rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Trader Action Plan</span>
                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-md text-[10px] font-bold">
                      Disciplined
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div>
                      <span className="text-gray-500 block text-[10px] font-bold uppercase">Seller Mode</span>
                      <span className="text-purple-300 font-bold">{quantData.action_plan.seller_mode}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px] font-bold uppercase">Avoid Condition</span>
                      <span className="text-amber-400 text-[11px]">{quantData.action_plan.avoid}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-borderClr/60 text-[11px] text-gray-400">
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Invalidation</span>
                    <span className="text-red-300 font-mono text-[11px]">{quantData.action_plan.invalidation}</span>
                  </div>
                </div>

              </div>

              {/* V6 ENGINE UPGRADES: DECISION HIERARCHY & HEAVYWEIGHTS / TIME BLOCKS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. DECISION HIERARCHY & CONFLICT RESOLUTION */}
                <div className="bg-cardClr border border-borderClr rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white flex items-center gap-2">
                            <span>Decision Hierarchy & Ranking</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded">v6 Discipline</span>
                          </h3>
                          <span className="text-[11px] text-gray-400">
                            Priority-ranking replaces numeric weighted scores
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-mono font-bold">
                        <span>Regime: {quantData.directional_read?.regime || 'Range'}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-amber-300">VIX {quantData.directional_read?.vix || 13.5}</span>
                      </div>
                    </div>

                    {/* Dominant Factors */}
                    <div className="bg-black/30 border border-borderClr/70 rounded-xl p-3 mb-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                        Top Dominant Factors (Highest Hierarchy Tier)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {quantData.decision_hierarchy?.top_factors?.map((factor: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/25 rounded-lg text-xs text-indigo-200">
                            <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-semibold">{factor}</span>
                          </div>
                        )) || (
                          <span className="text-xs text-gray-400">Price Structure & Level Dynamics dominant</span>
                        )}
                      </div>
                    </div>

                    {/* Active Conflict Pair */}
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                        Active Conflict Pair & Resolution Rule
                      </span>
                      <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
                        {quantData.decision_hierarchy?.conflict_pair || 'Gap Direction vs Heavyweight Breadth → Higher tier wins.'}
                      </p>
                    </div>
                  </div>

                  {/* 3-Way Directional Probabilities */}
                  <div className="pt-3 border-t border-borderClr/60">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-400 font-bold text-[11px]">3-WAY DIRECTIONAL PROBABILITY</span>
                      <span className="text-[10px] text-gray-500 font-mono">{quantData.directional_read?.tag || 'Hierarchy weighted'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-emerald-400 font-bold block uppercase">⬆ Upside</span>
                        <span className="text-base font-black text-emerald-300 font-mono">{quantData.directional_read?.prob_upside || 25}%</span>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-blue-400 font-bold block uppercase">↔ Range</span>
                        <span className="text-base font-black text-blue-300 font-mono">{quantData.directional_read?.prob_range || 55}%</span>
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-rose-400 font-bold block uppercase">⬇ Downside</span>
                        <span className="text-base font-black text-rose-300 font-mono">{quantData.directional_read?.prob_downside || 20}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. QUANTIFIED HEAVYWEIGHTS & REMAINING TIME BLOCKS */}
                <div className="bg-cardClr border border-borderClr rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white flex items-center gap-2">
                            <span>Top 5 Heavyweights</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">Real-Time</span>
                          </h3>
                          <span className="text-[11px] text-gray-400">
                            HDFCBANK · ICICIBANK · RELIANCE · INFY · TCS
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-gray-400">
                        {quantData.heavyweights?.green_count ?? 3}/5 Green
                      </span>
                    </div>

                    {/* Heavyweight Meters */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-black/40 border border-borderClr/60 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-gray-400 block font-bold">Green / Positive</span>
                        <span className={`text-sm font-black font-mono ${(quantData.heavyweights?.green_count ?? 0) >= 3 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {quantData.heavyweights?.green_count ?? 0}/5
                        </span>
                      </div>
                      <div className="bg-black/40 border border-borderClr/60 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-gray-400 block font-bold">Above VWAP</span>
                        <span className={`text-sm font-black font-mono ${(quantData.heavyweights?.above_vwap_count ?? 0) >= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {quantData.heavyweights?.above_vwap_count ?? 0}/5
                        </span>
                      </div>
                      <div className="bg-black/40 border border-borderClr/60 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-gray-400 block font-bold">Above Open High</span>
                        <span className={`text-sm font-black font-mono ${(quantData.heavyweights?.above_open_high_count ?? 0) >= 3 ? 'text-emerald-400' : 'text-blue-400'}`}>
                          {quantData.heavyweights?.above_open_high_count ?? 0}/5
                        </span>
                      </div>
                    </div>

                    {/* Stock Chips */}
                    {quantData.heavyweights?.stocks && quantData.heavyweights.stocks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {quantData.heavyweights.stocks.map((stk: any, idx: number) => {
                          const isGreen = stk.change_pct >= 0;
                          return (
                            <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-black/40 border border-borderClr/70 rounded-lg text-[11px]">
                              <span className="font-bold text-gray-200">{stk.symbol}</span>
                              <span className={`font-mono font-bold ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isGreen ? '+' : ''}{stk.change_pct}%
                              </span>
                              {stk.above_vwap && (
                                <span className="text-[9px] px-1 bg-blue-500/20 text-blue-300 rounded font-mono">VWAP+</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Remaining Time Blocks */}
                  <div className="pt-3 border-t border-borderClr/60">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                      Remaining Session Time Blocks
                    </span>
                    <div className="space-y-1.5">
                      {quantData.time_blocks_remaining?.map((block: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-black/30 border border-borderClr/50 rounded-xl text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-gray-300 text-[11px]">{block.block}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              block.lean === 'Bullish' ? 'bg-emerald-500/20 text-emerald-300' :
                              block.lean === 'Bearish' ? 'bg-rose-500/20 text-rose-300' :
                              'bg-gray-700/50 text-gray-300'
                            }`}>
                              {block.lean}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-gray-300 block">{block.driver}</span>
                            <span className="text-[10px] text-gray-500 font-mono">Watch: {block.watch_level}</span>
                          </div>
                        </div>
                      )) || (
                        <span className="text-xs text-gray-500 italic">No time blocks remaining in active session</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* DUAL TRACK FOR SMALL CAPITAL: TRACK A & TRACK B */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* TRACK A: NIFTYBEES ZERO-DECAY EXECUTION */}
                <div className="bg-gradient-to-br from-cardClr via-[#131b2e] to-cardClr border border-cyan-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                  
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white flex items-center gap-2">
                            <span>Track A: NIFTYBEES Index ETF</span>
                          </h3>
                          <span className="text-[11px] text-cyan-300/90 font-medium">
                            Zero Time Decay · Complete Elimination of Theta Drag
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-mono font-bold">
                        CMP ₹{quantData.niftybees_track.cmp}
                      </span>
                    </div>

                    <p className="text-xs text-gray-300 leading-relaxed bg-black/30 border border-borderClr/50 rounded-xl p-3 mb-4">
                      For traders with <strong>₹500 to ₹50,000 capital</strong>, buying NIFTYBEES at deep support 
                      removes all option expiration and time decay wipeouts. You participate in 100% of index movements 
                      without Greeks risk.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">
                          Support Buy Zone (ETF)
                        </span>
                        <div className="text-base font-mono font-black text-white">
                          {quantData.niftybees_track.buy_zone_str}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">
                          Aligned with Nifty {quantData.walls.put_wall_strike} Wall
                        </span>
                      </div>

                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                        <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">
                          Target Zone (ETF)
                        </span>
                        <div className="text-base font-mono font-black text-white">
                          {quantData.niftybees_track.target_zone_str}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">
                          Aligned with Nifty {quantData.walls.call_wall_strike} Wall
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-borderClr/40">
                      <span>Conversion Ratio:</span>
                      <span className="font-mono text-gray-200">1 Nifty = {quantData.niftybees_track.ratio} NIFTYBEES</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-borderClr/60 flex items-center justify-between">
                    <span className="text-[11px] text-red-400">
                      {quantData.niftybees_track.invalidation_str}
                    </span>
                    <button
                      onClick={handleOpenEtfOrder}
                      className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-lg flex items-center gap-2"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>Paper Trade ETF</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* TRACK B: DEFINED-RISK CREDIT SPREAD */}
                <div className="bg-gradient-to-br from-cardClr via-[#1e172a] to-cardClr border border-purple-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                  
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
                          <Scale className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white flex items-center gap-2">
                            <span>Track B: Defined-Risk Credit Spread</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-bold">
                              v14 Option-Selling Engine
                            </span>
                          </h3>
                          <span className="text-[11px] text-purple-300/90 font-medium">
                            {quantData.defined_risk_spread.spread_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2.5 py-1 bg-purple-500/15 border border-purple-500/40 text-purple-300 rounded-lg text-xs font-bold">
                          {quantData.defined_risk_spread.seller_view || quantData.seller_structural_comparison.seller_view}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 border border-borderClr/60 text-amber-300 rounded font-bold">
                          MODE: {quantData.defined_risk_spread.seller_mode || 'NON-DIRECTIONAL'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-black/30 border border-borderClr/50 rounded-xl p-3 mb-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-400 font-bold">Sell Leg (Primary):</span>
                        <span className="font-mono font-bold text-white">{quantData.defined_risk_spread.short_leg}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-blue-400 font-bold">Hedge Leg (Protection):</span>
                        <span className="font-mono font-bold text-white">{quantData.defined_risk_spread.long_leg}</span>
                      </div>
                    </div>

                    {/* v14 ATM-First & E4 Range Metric Strip */}
                    <div className="flex items-center justify-between text-[11px] px-3 py-2 bg-black/40 rounded-xl border border-borderClr/50 mb-3">
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Strike Selection Logic</span>
                        <span className="text-purple-300 font-bold font-mono">
                          {quantData.defined_risk_spread.atm_note || 'ATM-First Guard Passed'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">E4 Range Prob (±0.25×ATR)</span>
                        <span className="text-cyan-300 font-mono font-bold">
                          {quantData.defined_risk_spread.e4_prob}% ({quantData.defined_risk_spread.e4_range_str})
                        </span>
                      </div>
                    </div>

                    {/* Margin Slashed Highlight */}
                    <div className="bg-gradient-to-r from-emerald-500/15 to-purple-500/15 border border-emerald-500/30 rounded-xl p-3 mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-gray-300">Capital Required (Margin)</span>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold">
                          ⚡ Saved {quantData.defined_risk_spread.margin_saved_pct}% Margin
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-xs text-gray-400 line-through mr-2">
                            ₹{quantData.defined_risk_spread.naked_margin.toLocaleString()} (Naked)
                          </span>
                          <span className="text-lg font-mono font-black text-emerald-400">
                            ₹{quantData.defined_risk_spread.spread_margin.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 font-mono">Lot Size: {quantData.defined_risk_spread.lot_size}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 bg-black/40 rounded-xl border border-borderClr/40">
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Max Profit / Lot</span>
                        <span className="text-emerald-400 font-mono font-bold text-sm">
                          +₹{quantData.defined_risk_spread.max_profit_lot}
                        </span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          (+{quantData.defined_risk_spread.net_credit_pts} pts net credit)
                        </span>
                      </div>

                      <div className="p-2.5 bg-black/40 rounded-xl border border-borderClr/40">
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Max Risk / Lot (Capped)</span>
                        <span className="text-red-400 font-mono font-bold text-sm">
                          -₹{quantData.defined_risk_spread.max_risk_lot}
                        </span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          Ratio: {quantData.defined_risk_spread.risk_reward_ratio}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-borderClr/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400 truncate max-w-[200px] sm:max-w-none">
                      Invalidation: <strong className="text-white">{quantData.action_plan.invalidation}</strong>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReportTab('v14_selling');
                          setShowRawMarkdown(true);
                        }}
                        className="px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>v14 Report</span>
                      </button>
                      <button
                        onClick={handleOpenSpreadOrder}
                        className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-lg flex items-center gap-2"
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Paper Trade Spread</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* CALL VS PUT STRUCTURAL SELLER COMPARISON MATRIX */}
              <div className="bg-cardClr border border-borderClr rounded-2xl p-6 shadow-xl flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-borderClr/60 pb-4">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Scale className="w-5 h-5 text-purple-400" />
                      <span>CALL vs PUT Structural Seller Comparison</span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Separates market direction from seller-side structure. Evaluates which side provides superior defensive walls and room.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold self-start sm:self-auto">
                    {quantData.seller_structural_comparison.seller_view}
                  </span>
                </div>

                {/* Comparison Table */}
                <div className="overflow-x-auto border border-borderClr/60 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black/40 text-gray-400 font-bold uppercase tracking-wider border-b border-borderClr/60">
                      <tr>
                        <th className="p-3.5">Structural Seller Factor</th>
                        <th className="p-3.5 text-center">CALL SELL STRUCTURE</th>
                        <th className="p-3.5 text-center">PUT SELL STRUCTURE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderClr/40 font-mono">
                      {quantData.seller_structural_comparison.factors.map((f: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3.5 font-sans font-bold text-gray-300">
                            {f.factor}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                f.call_status === 'green' ? 'bg-emerald-400' : f.call_status === 'red' ? 'bg-red-400' : 'bg-amber-400'
                              }`} />
                              <span className="text-gray-200">{f.call}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                f.put_status === 'green' ? 'bg-emerald-400' : f.put_status === 'red' ? 'bg-red-400' : 'bg-amber-400'
                              }`} />
                              <span className="text-gray-200">{f.put}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Final Seller View Verdict */}
                <div className="p-4 bg-black/40 border border-purple-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-0.5">
                      Official Engine Seller Verdict
                    </span>
                    <p className="text-gray-300 font-medium">
                      {quantData.seller_structural_comparison.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg font-bold">
                      Target Side: {quantData.seller_structural_comparison.preferred_side}
                    </span>
                  </div>
                </div>

              </div>

            </div>
          )}

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

      {/* PLACE ORDER IN PAPER TRADE BOOK MODAL */}
      {orderModalData && orderModalData.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111827] border border-borderClr rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-borderClr/60 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Place Trade in Paper Trade Book
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Live virtual simulation book with real-time mark-to-market P&L tracking
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOrderModalData(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4 text-xs max-h-[80vh] overflow-y-auto">
              
              {/* Execution Mode Selector */}
              <div className="flex items-center justify-between p-1.5 bg-black/60 border border-borderClr rounded-2xl">
                <button
                  type="button"
                  onClick={() => setOrderModalData({ ...orderModalData, broker: 'paper' })}
                  className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    orderModalData.broker === 'paper'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>📘 Paper Trade (Simulation)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderModalData({ ...orderModalData, broker: 'dhan' })}
                  className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    orderModalData.broker === 'dhan'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>⚡ Live Broker (Dhan API)</span>
                </button>
              </div>

              {/* Strategy Name & Description */}
              <div className="p-3.5 bg-black/30 border border-borderClr/60 rounded-2xl flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-purple-400">Strategy Setup</span>
                <div className="text-sm font-black text-white">{orderModalData.name}</div>
                <div className="text-[11px] text-gray-400">{orderModalData.description}</div>
              </div>

              {/* Quantity / Lots Input */}
              <div className="flex items-center justify-between p-3.5 bg-black/40 border border-borderClr/60 rounded-2xl">
                <div>
                  <span className="text-xs font-bold text-gray-200 block">
                    {orderModalData.type === 'ETF' ? 'Number of ETF Shares' : 'Number of Spread Lots'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {orderModalData.type === 'ETF'
                      ? `1 Share ≈ ₹${orderModalData.legs[0]?.entryPrice}`
                      : `1 Lot = ${orderModalData.lotSize} Qty`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const step = orderModalData.type === 'ETF' ? 25 : 1;
                      const next = Math.max(step, orderModalData.qty - step);
                      setOrderModalData({ ...orderModalData, qty: next });
                    }}
                    className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="font-mono font-black text-white text-sm px-3">
                    {orderModalData.qty} {orderModalData.type === 'ETF' ? 'Shares' : 'Lots'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const step = orderModalData.type === 'ETF' ? 25 : 1;
                      const next = orderModalData.qty + step;
                      setOrderModalData({ ...orderModalData, qty: next });
                    }}
                    className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Legs Table */}
              <div className="border border-borderClr/60 rounded-2xl overflow-hidden">
                <div className="p-2.5 bg-black/50 border-b border-borderClr/60 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Order Legs</span>
                  <span>{orderModalData.legs.length} Leg(s)</span>
                </div>
                <div className="divide-y divide-borderClr/40 font-mono">
                  {orderModalData.legs.map((leg, idx) => {
                    const totalQty = orderModalData.type === 'ETF' 
                      ? orderModalData.qty 
                      : (orderModalData.lotSize * orderModalData.qty);
                    return (
                      <div key={idx} className="p-3 bg-black/20 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            leg.action === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {leg.action}
                          </span>
                          <div>
                            <span className="text-white font-bold">
                              {leg.strike > 0 ? `${leg.strike} ${leg.optionType === 'C' ? 'CE' : 'PE'}` : orderModalData.symbol}
                            </span>
                            <span className="text-[10px] text-gray-400 block font-sans">
                              {leg.expiry} Expiry
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-bold">₹{leg.entryPrice}</span>
                          <span className="text-[10px] text-gray-400 block">
                            Qty: {totalQty}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Risk & Reward Summary */}
              <div className="p-4 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Capital / Margin Required:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    ₹{((orderModalData.margin || 28500) * (orderModalData.type === 'ETF' ? (orderModalData.qty / 100) : orderModalData.qty)).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Max Profit Potential:</span>
                  <span className="font-mono font-bold text-white text-xs">{orderModalData.maxProfit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Risk Profile:</span>
                  <span className="font-mono font-bold text-red-300 text-xs">{orderModalData.maxLoss}</span>
                </div>
                {orderModalData.invalidation && (
                  <div className="pt-2 border-t border-borderClr/40 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Invalidation Rule:</span>
                    <span className="text-amber-400 font-bold">{orderModalData.invalidation}</span>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-borderClr/60 bg-black/40 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setOrderModalData(null)}
                className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-xs font-bold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmittingOrder}
                onClick={handleConfirmOrder}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-xl disabled:opacity-50"
              >
                {isSubmittingOrder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Booking Trade...</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Confirm & Book in {orderModalData.broker.toUpperCase()} Book</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ORDER SUCCESS NOTIFICATION MODAL */}
      {orderSuccessBanner && orderSuccessBanner.show && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111827] border border-emerald-500/40 rounded-3xl w-full max-w-md shadow-2xl p-6 flex flex-col items-center text-center gap-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div>
              <h3 className="text-base font-black text-white">{orderSuccessBanner.title}</h3>
              <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                {orderSuccessBanner.message}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full mt-2">
              <button
                type="button"
                onClick={() => setOrderSuccessBanner(null)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-all"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderSuccessBanner(null);
                  window.location.hash = 'portfolios';
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg flex items-center justify-center gap-1.5"
              >
                <span>View Paper Book</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUANT & OPTION-SELLING REPORT MODAL */}
      {showRawMarkdown && quantData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111827] border border-borderClr rounded-3xl w-full max-w-4xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-borderClr">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>
                      {activeReportTab === 'v14_selling'
                        ? 'NIFTY 50 — INTRADAY OPTION-SELLING ENGINE (v14)'
                        : 'NIFTY 50 QUANT READ → NIFTYBEES LEVELS (v6)'}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px] font-bold font-mono">
                      {quantData.data_quality?.live_count || 8}/9 LIVE
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {activeReportTab === 'v14_selling'
                      ? 'Two-Layer Philosophy · ATM-First Strike Selection · 14-Factor Seller Matrix · E4 Range Probability'
                      : '15:15 IST Reference Close · Decision Hierarchy · Heuristic Opening Behaviour Engine · Quantified Heavyweights'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRawMarkdown(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Tab Switcher & Copy Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-1 border-b border-borderClr/40">
              <div className="flex bg-black/60 p-1 rounded-xl border border-borderClr/60 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveReportTab('v14_selling')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeReportTab === 'v14_selling'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>⚡ v14 Option-Selling (Spread)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReportTab('v6_niftybees')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeReportTab === 'v6_niftybees'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>🧠 v6 NIFTYBEES Read</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 hidden sm:inline">1-Click Verbatim Copy:</span>
                <button
                  type="button"
                  onClick={() => {
                    const reportText = activeReportTab === 'v14_selling'
                      ? (quantData.raw_v14_selling_markdown || quantData.raw_v6_markdown)
                      : quantData.raw_v6_markdown;
                    if (reportText) {
                      navigator.clipboard.writeText(reportText);
                      setCopiedRawReport(true);
                      setTimeout(() => setCopiedRawReport(false), 2500);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg transition-all text-xs"
                >
                  {copiedRawReport ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy {activeReportTab === 'v14_selling' ? 'v14 Report' : 'v6 Report'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-2xl bg-[#0d1117] border border-borderClr/80 p-5 mt-3">
              <pre className="font-mono text-xs text-gray-200 whitespace-pre-wrap leading-relaxed select-text">
                {activeReportTab === 'v14_selling'
                  ? (quantData.raw_v14_selling_markdown || quantData.raw_v6_markdown || "Generating v14 option selling report...")
                  : (quantData.raw_v6_markdown || "Generating v6 quant report...")}
              </pre>
            </div>

            <div className="pt-4 mt-2 border-t border-borderClr/70 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRawMarkdown(false)}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

