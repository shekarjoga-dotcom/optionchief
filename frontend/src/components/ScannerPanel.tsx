import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { scanStrategies } from '../utils/scanner';
import type { ScannedStrategy } from '../utils/scanner';
import { projectStrategy, parseExpiryDate, getLotSizeForSymbol, getCurrencySymbol } from '../utils/optionsMath';
import { ExpirySelector } from './ExpirySelector';
import {
  ResponsiveContainer,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  Line,
  Area,
  CartesianGrid
} from 'recharts';
import {
  Play,
  Coins,
  Search,
  Layers,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  ShieldAlert,
  LineChart,
  Sparkles,
  Wind,
  Activity,
  Compass,
  Clock,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  XCircle
} from 'lucide-react';


interface SubCategoryOption {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
}

const CATEGORIES = [
  { id: 'all', label: 'All Strategies', icon: Layers, activeClass: 'bg-white text-black border-white' },
  { id: 'bullish', label: 'Bullish', icon: TrendingUp, activeClass: 'bg-[#4f46e5] text-white border-[#4f46e5]' },
  { id: 'bearish', label: 'Bearish', icon: TrendingDown, activeClass: 'bg-red-600 text-white border-red-600' },
  { id: 'neutral', label: 'Neutral', icon: Scale, activeClass: 'bg-cyan-500 text-black border-cyan-500' },
  { id: 'safe_hedged', label: 'Safe Hedged (Theta Decay)', icon: ShieldCheck, activeClass: 'bg-[#f59e0b] text-black border-[#f59e0b]' }
] as const;

const SUB_CATEGORIES_MAP: Record<string, SubCategoryOption[]> = {
  all: [
    { id: "ALL", label: "All in Category", icon: Layers },
    { id: "IRON CONDOR", label: "Iron Condor", icon: Compass },
    { id: "WIDE WING IRON CONDOR", label: "Wide Wing Iron Condor", icon: Compass },
    { id: "RATIO IRON CONDOR (1:2)", label: "Ratio Iron Condor (1:2)", icon: Compass },
    { id: "IRON BUTTERFLY", label: "Iron Butterfly", icon: Sparkles },
    { id: "BULL PUT SPREAD", label: "Bull Put Spread", icon: ShieldCheck },
    { id: "BEAR CALL SPREAD", label: "Bear Call Spread", icon: ShieldAlert },
    { id: "BULL CALL SPREAD", label: "Bull Call Spread", icon: LineChart },
    { id: "BEAR PUT SPREAD", label: "Bear Put Spread", icon: LineChart },
    { id: "CALL BUTTERFLY", label: "Call Butterfly", icon: Activity },
    { id: "PUT BUTTERFLY", label: "Put Butterfly", icon: Activity },
    { id: "CALL CONDOR", label: "Call Condor", icon: Wind },
    { id: "PUT CONDOR", label: "Put Condor", icon: Wind },
    { id: "1:2 PUT RATIO SPREAD", label: "1:2 Put Ratio Spread", icon: Scale },
    { id: "1:2 CALL RATIO SPREAD", label: "1:2 Call Ratio Spread", icon: Scale },
    { id: "LONG STRADDLE", label: "Long Straddle", icon: Activity },
    { id: "SHORT STRADDLE", label: "Short Straddle", icon: Scale },
    { id: "LONG STRANGLE", label: "Long Strangle", icon: Compass },
    { id: "SHORT STRANGLE", label: "Short Strangle", icon: SlidersHorizontal },
    { id: "HEDGED SHORT STRANGLE", label: "Hedged Short Strangle", icon: ShieldCheck },
    { id: "BULL STRADDLE", label: "Bull Straddle", icon: Activity },
    { id: "BEAR STRADDLE", label: "Bear Straddle", icon: Activity },
    { id: "SHORT BULL STRADDLE", label: "Short Bull Straddle", icon: Scale },
    { id: "SHORT BEAR STRADDLE", label: "Short Bear Straddle", icon: Scale },
    { id: "BULL STRANGLE", label: "Bull Strangle", icon: Compass },
    { id: "BEAR STRANGLE", label: "Bear Strangle", icon: Compass },
    { id: "SHORT BULL STRANGLE", label: "Short Bull Strangle", icon: SlidersHorizontal },
    { id: "SHORT BEAR STRANGLE", label: "Short Bear Strangle", icon: SlidersHorizontal },
    { id: "COVERED CALL", label: "Covered Call", icon: LineChart },
    { id: "COVERED PUT", label: "Covered Put", icon: LineChart },
    { id: "SYNTHETIC LONG", label: "Synthetic Long Stock", icon: LineChart },
    { id: "SYNTHETIC SHORT", label: "Synthetic Short Stock", icon: LineChart },
    { id: "SYNTHETIC LONG CALL", label: "Synthetic Long Call", icon: Sparkles },
    { id: "SYNTHETIC LONG PUT", label: "Synthetic Long Put", icon: Sparkles }
  ],
  bullish: [
    { id: "ALL", label: "All in Category", icon: Layers },
    { id: "BULL CALL SPREAD", label: "Bull Call Spread", icon: LineChart },
    { id: "BULL PUT SPREAD", label: "Bull Put Spread", icon: ShieldCheck },
    { id: "1:2 PUT RATIO SPREAD", label: "1:2 Put Ratio Spread", icon: Scale },
    { id: "DIR BULL FLY", label: "Dir Bull Fly", icon: Sparkles },
    { id: "BULL CONDOR", label: "Bull Condor", icon: Wind },
    { id: "BULL IRON BUTTERFLY", label: "Bull Iron Butterfly", icon: Activity },
    { id: "1:3:2 CALL RATIO FLY", label: "1:3:2 Call Ratio Fly", icon: Scale },
    { id: "BULL STRADDLE", label: "Bull Straddle (Volatile)", icon: Activity },
    { id: "BULL STRANGLE", label: "Bull Strangle (Volatile)", icon: Compass },
    { id: "SHORT BULL STRADDLE", label: "Short Bull Straddle", icon: Scale },
    { id: "SHORT BULL STRANGLE", label: "Short Bull Strangle", icon: SlidersHorizontal },
    { id: "COVERED CALL", label: "Covered Call", icon: LineChart },
    { id: "SYNTHETIC LONG", label: "Synthetic Long Stock", icon: LineChart },
    { id: "SYNTHETIC LONG CALL", label: "Synthetic Long Call", icon: Sparkles }
  ],
  bearish: [
    { id: "ALL", label: "All in Category", icon: Layers },
    { id: "BEAR CALL SPREAD", label: "Bear Call Spread", icon: ShieldAlert },
    { id: "BEAR PUT SPREAD", label: "Bear Put Spread", icon: LineChart },
    { id: "1:2 CALL RATIO SPREAD", label: "1:2 Call Ratio Spread", icon: Scale },
    { id: "DIR BEAR FLY", label: "Dir Bear Fly", icon: Sparkles },
    { id: "BEAR CONDOR", label: "Bear Condor", icon: Wind },
    { id: "BEAR IRON BUTTERFLY", label: "Bear Iron Butterfly", icon: Activity },
    { id: "1:3:2 PUT RATIO FLY", label: "1:3:2 Put Ratio Fly", icon: Scale },
    { id: "BEAR STRADDLE", label: "Bear Straddle (Volatile)", icon: Activity },
    { id: "BEAR STRANGLE", label: "Bear Strangle (Volatile)", icon: Compass },
    { id: "SHORT BEAR STRADDLE", label: "Short Bear Strangle", icon: Scale },
    { id: "SHORT BEAR STRANGLE", label: "Short Bear Strangle", icon: SlidersHorizontal },
    { id: "COVERED PUT", label: "Covered Put", icon: LineChart },
    { id: "SYNTHETIC SHORT", label: "Synthetic Short Stock", icon: LineChart },
    { id: "SYNTHETIC LONG PUT", label: "Synthetic Long Put", icon: Sparkles }
  ],
  neutral: [
    { id: "ALL", label: "All in Category", icon: Layers },
    { id: "IRON CONDOR", label: "Iron Condor", icon: Compass },
    { id: "WIDE WING IRON CONDOR", label: "Wide Wing Iron Condor", icon: Compass },
    { id: "RATIO IRON CONDOR (1:2)", label: "Ratio Iron Condor (1:2)", icon: Compass },
    { id: "IRON BUTTERFLY", label: "Iron Butterfly", icon: Sparkles },
    { id: "CALL BUTTERFLY", label: "Call Butterfly", icon: Activity },
    { id: "PUT BUTTERFLY", label: "Put Butterfly", icon: Activity },
    { id: "CALL CONDOR", label: "Call Condor", icon: Wind },
    { id: "PUT CONDOR", label: "Put Condor", icon: Wind },
    { id: "SHORT STRADDLE", label: "Short Straddle", icon: Scale },
    { id: "SHORT STRANGLE", label: "Short Strangle", icon: SlidersHorizontal },
    { id: "HEDGED SHORT STRANGLE", label: "Hedged Short Strangle", icon: ShieldCheck },
    { id: "COVERED CALL", label: "Covered Call", icon: LineChart },
    { id: "COVERED PUT", label: "Covered Put", icon: LineChart }
  ],
  safe_hedged: [
    { id: "ALL", label: "All in Category", icon: Layers },
    { id: "IRON CONDOR", label: "Iron Condor", icon: Compass },
    { id: "WIDE WING IRON CONDOR", label: "Wide Wing Iron Condor", icon: Compass },
    { id: "RATIO IRON CONDOR (1:2)", label: "Ratio Iron Condor (1:2)", icon: Compass },
    { id: "IRON BUTTERFLY", label: "Iron Butterfly", icon: Sparkles },
    { id: "BULL PUT SPREAD", label: "Bull Put Spread", icon: ShieldCheck },
    { id: "BEAR CALL SPREAD", label: "Bear Call Spread", icon: ShieldAlert },
    { id: "CALL BUTTERFLY", label: "Call Butterfly", icon: Activity },
    { id: "PUT BUTTERFLY", label: "Put Butterfly", icon: Activity },
    { id: "CALL CONDOR", label: "Call Condor", icon: Wind },
    { id: "1:2 PUT RATIO SPREAD", label: "1:2 Put Ratio Spread", icon: Scale },
    { id: "1:2 CALL RATIO SPREAD", label: "1:2 Call Ratio Spread", icon: Scale },
    { id: "SHORT STRADDLE", label: "Short Straddle", icon: Scale },
    { id: "SHORT STRANGLE", label: "Short Strangle", icon: SlidersHorizontal },
    { id: "HEDGED SHORT STRANGLE", label: "Hedged Short Strangle", icon: ShieldCheck }
  ]
};

import { BACKEND_URL } from '../config';

const getRiskRewardRatio = (maxProfit: any, maxLoss: any): string => {
  const profitNum = Number(maxProfit);
  const lossNum = Number(maxLoss);
  if (isNaN(profitNum) || isNaN(lossNum) || !isFinite(profitNum) || !isFinite(lossNum)) {
    return '1:Unlimited';
  }
  const absLoss = Math.abs(lossNum);
  if (absLoss <= 0) {
    return '0:1';
  }
  const ratio = profitNum / absLoss;
  return `1:${ratio.toFixed(2)}`;
};

export const ScannerPanel: React.FC = () => {
  const { symbol, options, underlying, selectedExpiry, expiryDates, loadLegs, fetchPortfolios, user, token, setSymbol } = useStore();

  const spot = underlying?.spot || 0;



  // Scanner parameters
  const [minWingWidth, setMinWingWidth] = useState(() => parseInt(localStorage.getItem("options_oracle_scanner_min_wing") || "1"));
  const [maxWingWidth, setMaxWingWidth] = useState(() => parseInt(localStorage.getItem("options_oracle_scanner_max_wing") || "4"));
  const [minDist, setMinDist] = useState(() => parseInt(localStorage.getItem("options_oracle_scanner_min_dist") || "1"));
  const [maxDist, setMaxDist] = useState(() => parseInt(localStorage.getItem("options_oracle_scanner_max_dist") || "20"));
  const [scanStep, setScanStep] = useState(() => parseInt(localStorage.getItem("options_oracle_scanner_step") || "1"));
  const [riskFreeRate, setRiskFreeRate] = useState(() => parseFloat(localStorage.getItem("options_oracle_scanner_rfr") || "6.0"));
  const [lotSize, setLotSize] = useState(() => parseInt(localStorage.getItem("options_oracle_scanner_lot") || "65"));
  
  // Greeks filter parameters
  const [filterMinDelta, setFilterMinDelta] = useState<string>("");
  const [filterMaxDelta, setFilterMaxDelta] = useState<string>("");
  const [filterMinTheta, setFilterMinTheta] = useState<string>("");
  const [filterMaxGamma, setFilterMaxGamma] = useState<string>("");
  
  // Expiries to Scan list
  const [selectedExpiries, setSelectedExpiries] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("options_oracle_scanner_selected_expiries");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("options_oracle_scanner_min_wing", String(minWingWidth));
  }, [minWingWidth]);

  useEffect(() => {
    localStorage.setItem("options_oracle_scanner_max_wing", String(maxWingWidth));
  }, [maxWingWidth]);

  useEffect(() => {
    localStorage.setItem("options_oracle_scanner_min_dist", String(minDist));
  }, [minDist]);

  useEffect(() => {
    localStorage.setItem("options_oracle_scanner_max_dist", String(maxDist));
  }, [maxDist]);

  useEffect(() => {
    localStorage.setItem("options_oracle_scanner_step", String(scanStep));
  }, [scanStep]);

  useEffect(() => {
    localStorage.setItem("options_oracle_scanner_rfr", String(riskFreeRate));
  }, [riskFreeRate]);

  useEffect(() => {
    localStorage.setItem("options_oracle_scanner_lot", String(lotSize));
  }, [lotSize]);

  useEffect(() => {
    localStorage.setItem("options_oracle_scanner_selected_expiries", JSON.stringify(selectedExpiries));
  }, [selectedExpiries]);

  // Lazy scroll visible count
  const [visibleCount, setVisibleCount] = useState(50);
  
  // Category & Sub-category
  const [category, setCategory] = useState<'all' | 'bullish' | 'bearish' | 'neutral' | 'safe_hedged'>('safe_hedged');
  const [subCategory, setSubCategory] = useState<string>("ALL");
  const [scannedResults, setScannedResults] = useState<ScannedStrategy[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Trade execution modal state
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeStrategy, setTradeStrategy] = useState<ScannedStrategy | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<'paper' | 'dhan' | 'kotak'>('paper');
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);

  // Advanced Column Range Filters State
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [popMin, setPopMin] = useState<string>('');
  const [popMax, setPopMax] = useState<string>('');
  const [distMin, setDistMin] = useState<string>('');
  const [distMax, setDistMax] = useState<string>('');
  const [profitMin, setProfitMin] = useState<string>('');
  const [profitMax, setProfitMax] = useState<string>('');
  const [lossMin, setLossMin] = useState<string>('');
  const [lossMax, setLossMax] = useState<string>('');
  const [rrMin, setRrMin] = useState<string>('');
  const [rrMax, setRrMax] = useState<string>('');
  const [marginMin, setMarginMin] = useState<string>('');
  const [marginMax, setMarginMax] = useState<string>('');
  const [premiumMin, setPremiumMin] = useState<string>('');
  const [premiumMax, setPremiumMax] = useState<string>('');

  const hasActiveFilters = useMemo(() => {
    return (
      popMin !== '' || popMax !== '' ||
      distMin !== '' || distMax !== '' ||
      profitMin !== '' || profitMax !== '' ||
      lossMin !== '' || lossMax !== '' ||
      rrMin !== '' || rrMax !== '' ||
      marginMin !== '' || marginMax !== '' ||
      premiumMin !== '' || premiumMax !== '' ||
      filterMinDelta !== '' || filterMaxDelta !== '' ||
      filterMinTheta !== '' || filterMaxGamma !== ''
    );
  }, [popMin, popMax, distMin, distMax, profitMin, profitMax, lossMin, lossMax, rrMin, rrMax, marginMin, marginMax, premiumMin, premiumMax, filterMinDelta, filterMaxDelta, filterMinTheta, filterMaxGamma]);

  const handleClearFilters = () => {
    setPopMin('');
    setPopMax('');
    setDistMin('');
    setDistMax('');
    setProfitMin('');
    setProfitMax('');
    setLossMin('');
    setLossMax('');
    setRrMin('');
    setRrMax('');
    setMarginMin('');
    setMarginMax('');
    setPremiumMin('');
    setPremiumMax('');
    setFilterMinDelta('');
    setFilterMaxDelta('');
    setFilterMinTheta('');
    setFilterMaxGamma('');
  };

  // Memoized filtered results
  const filteredResults = useMemo(() => {
    return scannedResults.filter((sc) => {
      // 1. POP filter
      if (popMin !== '') {
        const val = parseFloat(popMin);
        if (!isNaN(val) && sc.pop < val) return false;
      }
      if (popMax !== '') {
        const val = parseFloat(popMax);
        if (!isNaN(val) && sc.pop > val) return false;
      }

      // 2. Distance filter
      if (distMin !== '') {
        const val = parseFloat(distMin);
        if (!isNaN(val) && sc.distance < val) return false;
      }
      if (distMax !== '') {
        const val = parseFloat(distMax);
        if (!isNaN(val) && sc.distance > val) return false;
      }

      // 3. Max Profit filter
      if (profitMin !== '') {
        const val = parseFloat(profitMin);
        if (!isNaN(val)) {
          if (typeof sc.maxProfit === 'number') {
            if (sc.maxProfit < val) return false;
          }
        }
      }
      if (profitMax !== '') {
        const val = parseFloat(profitMax);
        if (!isNaN(val)) {
          if (typeof sc.maxProfit === 'number') {
            if (sc.maxProfit > val) return false;
          } else {
            return false;
          }
        }
      }

      // 4. Max Loss filter
      if (lossMin !== '') {
        const val = parseFloat(lossMin);
        if (!isNaN(val)) {
          if (typeof sc.maxLoss === 'number') {
            if (Math.abs(sc.maxLoss) < val) return false;
          }
        }
      }
      if (lossMax !== '') {
        const val = parseFloat(lossMax);
        if (!isNaN(val)) {
          if (typeof sc.maxLoss === 'number') {
            if (Math.abs(sc.maxLoss) > val) return false;
          } else {
            return false;
          }
        }
      }

      // 5. Risk:Reward filter
      const getRatioNum = (item: ScannedStrategy) => {
        const maxProfit = item.maxProfit;
        const maxLoss = item.maxLoss;
        if (typeof maxProfit !== 'number' || typeof maxLoss !== 'number') return 999999999;
        const absLoss = Math.abs(maxLoss);
        if (absLoss <= 0) return 999999999;
        return maxProfit / absLoss;
      };
      const rrRatio = getRatioNum(sc);
      if (rrMin !== '') {
        const val = parseFloat(rrMin);
        if (!isNaN(val) && rrRatio < val) return false;
      }
      if (rrMax !== '') {
        const val = parseFloat(rrMax);
        if (!isNaN(val) && rrRatio > val) return false;
      }

      // 6. Margin filter
      if (marginMin !== '') {
        const val = parseFloat(marginMin);
        if (!isNaN(val) && sc.margin < val) return false;
      }
      if (marginMax !== '') {
        const val = parseFloat(marginMax);
        if (!isNaN(val) && sc.margin > val) return false;
      }

      // 7. Net Premium filter
      if (premiumMin !== '') {
        const val = parseFloat(premiumMin);
        if (!isNaN(val) && sc.netDebitCredit < val) return false;
      }
      if (premiumMax !== '') {
        const val = parseFloat(premiumMax);
        if (!isNaN(val) && sc.netDebitCredit > val) return false;
      }

      // 8. Delta filter
      if (filterMinDelta !== '') {
        const val = parseFloat(filterMinDelta);
        if (!isNaN(val) && sc.delta < val) return false;
      }
      if (filterMaxDelta !== '') {
        const val = parseFloat(filterMaxDelta);
        if (!isNaN(val) && sc.delta > val) return false;
      }

      // 9. Theta filter
      if (filterMinTheta !== '') {
        const val = parseFloat(filterMinTheta);
        if (!isNaN(val) && sc.theta < val) return false;
      }

      // 10. Gamma filter
      if (filterMaxGamma !== '') {
        const val = parseFloat(filterMaxGamma);
        if (!isNaN(val) && sc.gamma > val) return false;
      }

      return true;
    });
  }, [
    scannedResults,
    popMin,
    popMax,
    distMin,
    distMax,
    profitMin,
    profitMax,
    lossMin,
    lossMax,
    rrMin,
    rrMax,
    marginMin,
    marginMax,
    premiumMin,
    premiumMax,
    filterMinDelta,
    filterMaxDelta,
    filterMinTheta,
    filterMaxGamma
  ]);

  // Sorting state
  const [sortField, setSortField] = useState<keyof ScannedStrategy | 'riskReward' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof ScannedStrategy | 'riskReward') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      if (['pop', 'maxProfit', 'netDebitCredit', 'distance', 'name', 'riskReward'].includes(field)) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  // Memoized sorted results
  const sortedResults = useMemo(() => {
    if (!sortField) return filteredResults;

    if (sortField === 'riskReward') {
      const getRatioNum = (item: ScannedStrategy) => {
        const maxProfit = item.maxProfit;
        const maxLoss = item.maxLoss;
        if (typeof maxProfit !== 'number' || typeof maxLoss !== 'number') return 999999999;
        const absLoss = Math.abs(maxLoss);
        if (absLoss <= 0) return 999999999;
        return maxProfit / absLoss;
      };
      return [...filteredResults].sort((a, b) => {
        const ratioA = getRatioNum(a);
        const ratioB = getRatioNum(b);
        return sortDirection === 'asc' ? ratioA - ratioB : ratioB - ratioA;
      });
    }

    return [...filteredResults].sort((a, b) => {
      let valA = a[sortField as keyof ScannedStrategy];
      let valB = b[sortField as keyof ScannedStrategy];

      // Handle custom comparisons
      if (sortField === 'maxProfit') {
        const numA = typeof valA === 'number' ? valA : 999999999;
        const numB = typeof valB === 'number' ? valB : 999999999;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      if (sortField === 'maxLoss') {
        const numA = typeof valA === 'number' ? valA : -999999999;
        const numB = typeof valB === 'number' ? valB : -999999999;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
  }, [filteredResults, sortField, sortDirection]);

  // Slice results down to visibleCount for virtual/lazy scroll
  const visibleResults = useMemo(() => {
    return sortedResults.slice(0, visibleCount);
  }, [sortedResults, visibleCount]);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setVisibleCount(prev => Math.min(sortedResults.length, prev + 50));
    }
  };

  // Selected strategy for payoff chart rendering
  const [selectedStrategy, setSelectedStrategy] = useState<ScannedStrategy | null>(null);
  const strategySpot = selectedStrategy?.spot || spot;
  const strategySymbol = selectedStrategy?.symbol || symbol;
  const cur = getCurrencySymbol(strategySymbol);
  const [payoffDaysPassed, setPayoffDaysPassed] = useState(0);
  const [payoffIvOffset, setPayoffIvOffset] = useState(0);

  const handleSelectStrategy = (sc: ScannedStrategy) => {
    setSelectedStrategy(sc);
    setPayoffDaysPassed(0);
    setPayoffIvOffset(0);
  };

  // Reset results and selection when expiry or symbol changes
  useEffect(() => {
    setScannedResults([]);
    setSelectedStrategy(null);
    if (selectedExpiry && expiryDates.includes(selectedExpiry)) {
      setSelectedExpiries([selectedExpiry]);
    } else if (expiryDates.length > 0) {
      setSelectedExpiries([expiryDates[0]]);
    }
  }, [selectedExpiry, symbol, expiryDates]);

  const selectedProjection = useMemo(() => {
    if (!selectedStrategy) return null;
    return projectStrategy(selectedStrategy.legs, strategySpot, payoffDaysPassed, payoffIvOffset, riskFreeRate / 100.0, strategySymbol);
  }, [selectedStrategy, strategySpot, payoffDaysPassed, payoffIvOffset, riskFreeRate, strategySymbol]);

  const totalDays = useMemo(() => {
    if (!selectedExpiry) return 10;
    const today = new Date();
    const expiryDate = parseExpiryDate(selectedExpiry);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [selectedExpiry]);


  // Sync default lot size and strike parameters when symbol changes
  useEffect(() => {
    const sym = symbol.toUpperCase();
    
    // 1. Sync Lot Size
    setLotSize(getLotSizeForSymbol(sym));

    // 2. Adjust Strike Parameters (Wings, Distance, Step)
    if (sym === "NIFTY" || sym === "BANKNIFTY" || sym === "FINNIFTY" || sym === "MIDCPNIFTY") {
      setMinWingWidth(1);
      setMaxWingWidth(4);
      setMinDist(2);
      setMaxDist(10);
      setScanStep(1);
    } else if (sym === "GOLD" || sym === "GOLDM") {
      setMinWingWidth(1);
      setMaxWingWidth(4);
      setMinDist(1);
      setMaxDist(10);
      setScanStep(1);
    } else if (sym === "SILVER" || sym === "SILVERM") {
      setMinWingWidth(1);
      setMaxWingWidth(4);
      setMinDist(1);
      setMaxDist(8);
      setScanStep(1);
    } else if (sym === "CRUDEOIL" || sym === "CRUDEOILM") {
      setMinWingWidth(1);
      setMaxWingWidth(4);
      setMinDist(2);
      setMaxDist(12);
      setScanStep(1);
    } else if (sym === "NATURALGAS" || sym === "NATGASMINI") {
      setMinWingWidth(1);
      setMaxWingWidth(4);
      setMinDist(1);
      setMaxDist(8);
      setScanStep(1);
    } else if (sym === "SPY" || sym === "AAPL" || sym === "MSFT" || sym === "TSLA") {
      setMinWingWidth(1);
      setMaxWingWidth(5);
      setMinDist(1);
      setMaxDist(12);
      setScanStep(1);
    } else {
      // Default equity/stock settings
      setMinWingWidth(1);
      setMaxWingWidth(3);
      setMinDist(1);
      setMaxDist(8);
      setScanStep(1);
    }
  }, [symbol]);

  const fetchOptionsForSymbolAndExpiry = async (sym: string, exp: string) => {
    if (sym === symbol && exp === selectedExpiry) {
      return { options, spot };
    }
    try {
      const response = await fetch(`${BACKEND_URL}/api/market/option-chain?symbol=${sym}&expiry=${exp}`);
      if (!response.ok) throw new Error("Fetch failed");
      const data = await response.json();
      return { options: data.options, spot: data.underlying.spot };
    } catch (err) {
      console.error(`Error fetching option chain for ${sym} expiry ${exp}`, err);
      return { options: [], spot: 0 };
    }
  };

  const handleScan = () => {
    if (selectedExpiries.length === 0) {
      alert("Please select at least one expiry to scan.");
      return;
    }
    setIsScanning(true);
    setSelectedStrategy(null); // Clear active strategy representation on recalculating scans
    setSortField(null); // Reset sorting to default
    setSortDirection('desc');

    // Defer scan slightly to allow loading animation to render
    setTimeout(async () => {
      try {
        const symbolsToScan = symbol === "ALL_NSE" 
          ? ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "SBIN", "ITC", "BHARTIARTL", "LT", "AXISBANK"]
          : [symbol];

        // Fetch option chains for all selected symbols and expiries in parallel
        const fetchResults = await Promise.all(
          symbolsToScan.flatMap(sym => 
            selectedExpiries.map(async (exp) => {
              const res = await fetchOptionsForSymbolAndExpiry(sym, exp);
              return { sym, exp, options: res.options, spot: res.spot };
            })
          )
        );

        const typesToScan = subCategory === "ALL"
          ? (category === "safe_hedged"
              ? ["IRON CONDOR", "IRON BUTTERFLY", "BULL PUT SPREAD", "BEAR CALL SPREAD", "CALL BUTTERFLY", "PUT BUTTERFLY", "CALL CONDOR", "WIDE WING IRON CONDOR", "1:2 PUT RATIO SPREAD", "1:2 CALL RATIO SPREAD", "SHORT STRADDLE", "SHORT STRANGLE", "HEDGED SHORT STRANGLE", "COVERED CALL", "COVERED PUT"]
              : category === "neutral"
                ? ["IRON CONDOR", "IRON BUTTERFLY", "CALL BUTTERFLY", "PUT BUTTERFLY", "CALL CONDOR", "PUT CONDOR", "WIDE WING IRON CONDOR", "SHORT STRADDLE", "SHORT STRANGLE", "HEDGED SHORT STRANGLE"]
                : category === "bullish"
                  ? ["BULL CALL SPREAD", "BULL PUT SPREAD", "DIR BULL FLY", "BULL CONDOR", "BULL IRON BUTTERFLY", "1:3:2 CALL RATIO FLY", "1:2 PUT RATIO SPREAD", "BULL STRADDLE", "BULL STRANGLE", "SHORT BULL STRADDLE", "SHORT BULL STRANGLE", "COVERED CALL", "SYNTHETIC LONG", "SYNTHETIC LONG CALL"]
                  : category === "bearish"
                    ? ["BEAR CALL SPREAD", "BEAR PUT SPREAD", "DIR BEAR FLY", "BEAR CONDOR", "BEAR IRON BUTTERFLY", "1:3:2 PUT RATIO FLY", "1:2 CALL RATIO SPREAD", "BEAR STRADDLE", "BEAR STRANGLE", "SHORT BEAR STRADDLE", "SHORT BEAR STRANGLE", "COVERED PUT", "SYNTHETIC SHORT", "SYNTHETIC LONG PUT"]
                    : [
                        "IRON CONDOR", "IRON BUTTERFLY", "BULL PUT SPREAD", "BEAR CALL SPREAD", 
                        "BULL CALL SPREAD", "BEAR PUT SPREAD", "CALL BUTTERFLY", "PUT BUTTERFLY", 
                        "CALL CONDOR", "PUT CONDOR", "DIR BULL FLY", "DIR BEAR FLY", 
                        "BULL CONDOR", "BEAR CONDOR", "BULL IRON BUTTERFLY", "BEAR IRON BUTTERFLY", 
                        "1:3:2 CALL RATIO FLY", "1:3:2 PUT RATIO FLY", "WIDE WING IRON CONDOR",
                        "1:2 PUT RATIO SPREAD", "1:2 CALL RATIO SPREAD", "LONG STRADDLE", 
                        "SHORT STRADDLE", "LONG STRANGLE", "SHORT STRANGLE",
                        "BULL STRADDLE", "BEAR STRADDLE", "SHORT BULL STRADDLE", "SHORT BEAR STRADDLE",
                        "BULL STRANGLE", "BEAR STRANGLE", "SHORT BULL STRANGLE", "SHORT BEAR STRANGLE",
                        "HEDGED SHORT STRANGLE", "COVERED CALL", "COVERED PUT",
                        "SYNTHETIC LONG", "SYNTHETIC SHORT", "SYNTHETIC LONG CALL", "SYNTHETIC LONG PUT"
                      ])
          : [subCategory];

        let allScans: ScannedStrategy[] = [];

        for (const res of fetchResults) {
          if (!res || !res.options || res.options.length === 0 || res.spot === 0) continue;

          for (let w = minWingWidth; w <= maxWingWidth; w++) {
            for (const t of typesToScan) {
              const resList = scanStrategies(
                t, 
                res.options, 
                res.spot, 
                res.exp, 
                w, 
                minDist, 
                maxDist, 
                scanStep, 
                getLotSizeForSymbol(res.sym), 
                riskFreeRate / 100.0,
                res.sym
              );
              allScans = [...allScans, ...resList];
            }
          }
        }

        // De-duplicate and filter out low-value "junk" strategies
        const uniqueScans: ScannedStrategy[] = [];
        const seenKeys = new Set<string>();
        for (const scan of allScans) {
          // 1. Calculate leg-based key for de-duplication
          const sortedLegs = [...scan.legs].sort((a, b) => a.strike - b.strike || a.optionType.localeCompare(b.optionType) || a.action.localeCompare(b.action));
          const legKey = sortedLegs.map(l => `${l.action}-${l.strike}-${l.optionType}-${l.expiry}`).join('|');
          
          if (seenKeys.has(legKey)) continue;

          // 2. Filter out meaningless strategies (e.g., risk-reward > 50x or return on margin < 0.25%)
          const profit = typeof scan.maxProfit === 'number' ? scan.maxProfit : null;
          const loss = typeof scan.maxLoss === 'number' ? Math.abs(scan.maxLoss) : null;
          const margin = scan.margin || 100000;

          // Discard if profit is too low to cover transaction fees (e.g. < ₹150)
          if (profit !== null && profit < 150) continue;

          // Discard if return on margin is less than 0.25% (250 INR for 1L margin)
          if (profit !== null && (profit / margin) < 0.0025) continue;

          // Discard if risk-to-reward ratio is too extreme (risking > 50x of potential profit)
          if (profit !== null && loss !== null && profit > 0 && (loss / profit) > 50) continue;

          seenKeys.add(legKey);
          uniqueScans.push(scan);
        }

        // Re-rank combined scans by POP * Expected yield
        const rankedScans = uniqueScans.sort((a, b) => {
          const lossA = typeof a.maxLoss === 'number' ? Math.abs(a.maxLoss) : 10000;
          const lossB = typeof b.maxLoss === 'number' ? Math.abs(b.maxLoss) : 10000;
          const scoreA = a.pop * (typeof a.maxProfit === 'number' ? a.maxProfit : 1000) / Math.max(1, lossA);
          const scoreB = b.pop * (typeof b.maxProfit === 'number' ? b.maxProfit : 1000) / Math.max(1, lossB);
          return scoreB - scoreA;
        });

        setScannedResults(rankedScans);
        setVisibleCount(50); // Reset infinite scroll view
      } catch (err) {
        console.error("Scanner failed", err);
      } finally {
        setIsScanning(false);
      }
    }, 100);
  };

  const handleLoad = (sc: ScannedStrategy) => {
    if (sc.symbol) {
      setSymbol(sc.symbol);
    }
    loadLegs(sc.legs);
    alert(`Loaded ${sc.name} strikes into Strategy Analyzer sandbox.`);
  };

  const handleOpenTradeModal = (sc: ScannedStrategy) => {
    setTradeStrategy(sc);
    setSelectedBroker('paper');
    setTradeModalOpen(true);
  };

  const handleExecuteTrade = async () => {
    if (!tradeStrategy) return;
    setIsExecutingTrade(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/portfolio/execute`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          broker: selectedBroker,
          name: tradeStrategy.name.split(" (")[0],
          symbol: tradeStrategy.symbol || symbol,
          description: tradeStrategy.description,
          legs: tradeStrategy.legs
        })
      });
      const data = await response.json();
      if (response.ok && data.status === "success") {
        let msg = `Successfully executed strategy on ${selectedBroker.toUpperCase()}!\n`;
        if (data.orders && data.orders.length > 0) {
          data.orders.forEach((o: any) => {
            msg += `\nLeg ${o.strike} ${o.type} (${o.action}): ${o.status} - ${o.message}`;
          });
        }
        alert(msg);
        setTradeModalOpen(false);
        fetchPortfolios(); // refresh portfolio list
      } else {
        alert(`Order Execution failed: ${data.detail || "Server error"}`);
      }
    } catch (err: any) {
      console.error("Trade execution failed", err);
      alert(`Trade execution failed: ${err.message || "Network error"}`);
    } finally {
      setIsExecutingTrade(false);
    }
  };

  // Sub-categories list is now rendered dynamically from SUB_CATEGORIES_MAP

  return (
    <div className="flex flex-col gap-6">
      {/* Category selector */}
      <div className="flex flex-wrap gap-2 items-center border-b border-borderClr/30 pb-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => { setCategory(cat.id); setSubCategory('ALL'); }}
              className={`px-4 py-2.5 rounded-lg text-xs font-extrabold transition-all border flex items-center gap-1.5 ${
                isActive
                  ? cat.activeClass
                  : "bg-gray-950 border-borderClr/60 text-gray-400 hover:text-white"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "" : "opacity-60"}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-categories selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {SUB_CATEGORIES_MAP[category]?.map((sub) => {
          const SubIcon = sub.icon;
          const isActive = subCategory === sub.id;
          
          let activeSubClass = "bg-accentBrand/20 border-accentBrand text-white";
          if (category === 'bullish') activeSubClass = "bg-[#4f46e5]/20 border-[#4f46e5]/60 text-indigo-300";
          else if (category === 'bearish') activeSubClass = "bg-red-600/20 border-red-600/60 text-red-300";
          else if (category === 'neutral') activeSubClass = "bg-cyan-500/20 border-cyan-500/60 text-cyan-300";
          else if (category === 'safe_hedged') activeSubClass = "bg-[#f59e0b]/20 border-[#f59e0b]/60 text-amber-300";
          else if (category === 'all') activeSubClass = "bg-white/10 border-white/40 text-white";

          return (
            <button
              key={sub.id}
              onClick={() => setSubCategory(sub.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                isActive
                  ? activeSubClass
                  : "bg-gray-950 border-borderClr/30 text-gray-500 hover:text-white"
              }`}
            >
              {sub.id !== 'ALL' && <SubIcon className="w-3.5 h-3.5 opacity-70" />}
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* Expiry Selector */}
      <div className="glass-panel rounded-xl p-4 border border-borderClr/30 flex flex-col gap-4">
        <ExpirySelector />
        
        {expiryDates.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-borderClr/20 pt-3">
            <div className="flex items-center justify-between text-xs text-gray-400 font-semibold uppercase tracking-wider">
              <span>Select Expiries to Scan</span>
              <span className="text-[10px] text-gray-500 font-normal">Select one or more targets for batch scanning</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {expiryDates.map((exp) => {
                const isSelected = selectedExpiries.includes(exp);
                return (
                  <button
                    key={exp}
                    onClick={() => {
                      setSelectedExpiries(prev => 
                        prev.includes(exp)
                          ? (prev.length > 1 ? prev.filter(e => e !== exp) : prev)
                          : [...prev, exp]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isSelected
                        ? "bg-accentCyan/20 border-accentCyan text-accentCyan shadow-sm"
                        : "bg-gray-950 border-borderClr/30 text-gray-400 hover:text-white"
                    }`}
                  >
                    {exp}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Scanner Input Panel */}
      <div className="glass-panel rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4 text-xs">
        {/* Spot Price (Read-only reference) */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 font-semibold uppercase">Spot ({cur})</span>
          <input
            type="text"
            value={spot.toFixed(2)}
            disabled
            className="bg-gray-950/60 border border-borderClr/40 rounded px-2.5 py-1.5 text-gray-400 focus:outline-none"
          />
        </div>

        {/* Risk-free Rate */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 font-semibold uppercase">Risk-free (%)</span>
          <input
            type="number"
            step="0.1"
            value={riskFreeRate}
            onChange={(e) => setRiskFreeRate(parseFloat(e.target.value) || 0)}
            className="bg-gray-950 border border-borderClr rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accentBrand"
          />
        </div>

        {/* Lot Size */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 font-semibold uppercase">Lot Size</span>
          <input
            type="number"
            value={lotSize}
            onChange={(e) => setLotSize(parseInt(e.target.value) || 0)}
            className="bg-gray-950 border border-borderClr rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accentBrand"
          />
        </div>

        {/* Min Wing Width */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 font-semibold uppercase">Min Wing (Strikes)</span>
          <input
            type="number"
            value={minWingWidth}
            onChange={(e) => setMinWingWidth(parseInt(e.target.value) || 1)}
            className="bg-gray-950 border border-borderClr rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accentBrand"
          />
        </div>

        {/* Max Wing Width */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 font-semibold uppercase">Max Wing (Strikes)</span>
          <input
            type="number"
            value={maxWingWidth}
            onChange={(e) => setMaxWingWidth(parseInt(e.target.value) || 1)}
            className="bg-gray-950 border border-borderClr rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accentBrand"
          />
        </div>

        {/* Min Distance */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 font-semibold uppercase">Min Dist (Strikes)</span>
          <input
            type="number"
            value={minDist}
            onChange={(e) => setMinDist(parseInt(e.target.value) || 0)}
            className="bg-gray-950 border border-borderClr rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accentBrand"
          />
        </div>

        {/* Max Distance */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 font-semibold uppercase">Max Dist (Strikes)</span>
          <input
            type="number"
            value={maxDist}
            onChange={(e) => setMaxDist(parseInt(e.target.value) || 0)}
            className="bg-gray-950 border border-borderClr rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accentBrand"
          />
        </div>

        {/* Scan Step */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 font-semibold uppercase">Step (Strikes)</span>
          <input
            type="number"
            value={scanStep}
            onChange={(e) => setScanStep(parseInt(e.target.value) || 1)}
            className="bg-gray-950 border border-borderClr rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accentBrand"
          />
        </div>

        {/* Scan Button */}
        <div className="flex flex-col justify-end">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full bg-greenBrand hover:bg-greenBrand/90 text-black font-extrabold px-3 py-2 rounded-lg flex items-center justify-center gap-1 transition-all h-[34px] disabled:opacity-50"
          >
            <Search className="w-4 h-4 text-black stroke-[3px]" />
            <span>{isScanning ? "Scanning..." : "Scan Symbol"}</span>
          </button>
        </div>
      </div>

      {/* Scanned Results List */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            All Scanned Strategy Opportunities {scannedResults.length > 0 ? (
              <span className="text-xs font-normal text-gray-400 lowercase normal-case">
                ({filteredResults.length} shown of {scannedResults.length} total)
              </span>
            ) : (
              <span>({scannedResults.length})</span>
            )}
          </h3>
          
          <div className="flex items-center gap-2">
            {scannedResults.length > 0 && (
              <button
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  isFiltersOpen || hasActiveFilters
                    ? "bg-accentCyan/15 border-accentCyan text-accentCyan shadow-sm"
                    : "bg-gray-950 border-borderClr/40 text-gray-400 hover:text-white"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accentCyan" />
                )}
                {isFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

          </div>
        </div>

        {/* Collapsible Range Filters Panel */}
        {isFiltersOpen && scannedResults.length > 0 && (
          <div className="glass-panel rounded-xl p-4 border border-borderClr/30 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-borderClr/20 pb-2.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-accentCyan" />
                Filter Opportunities by Column Ranges
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-[10px] font-extrabold text-redBrand hover:underline uppercase tracking-wider"
                >
                  Clear All Filters
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 text-xs">
              {/* POP */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">POP (%)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={popMin}
                    onChange={(e) => setPopMin(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                  <span className="text-gray-600 font-bold">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={popMax}
                    onChange={(e) => setPopMax(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Distance */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Strike Distance ({cur})</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={distMin}
                    onChange={(e) => setDistMin(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                  <span className="text-gray-600 font-bold">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={distMax}
                    onChange={(e) => setDistMax(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Max Profit */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Max Profit ({cur})</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={profitMin}
                    onChange={(e) => setProfitMin(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                  <span className="text-gray-600 font-bold">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={profitMax}
                    onChange={(e) => setProfitMax(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Max Loss */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Max Loss ({cur})</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={lossMin}
                    onChange={(e) => setLossMin(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                  <span className="text-gray-600 font-bold">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={lossMax}
                    onChange={(e) => setLossMax(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Risk:Reward Ratio */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Risk:Reward (Ratio)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Min"
                    value={rrMin}
                    onChange={(e) => setRrMin(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                  <span className="text-gray-600 font-bold">-</span>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Max"
                    value={rrMax}
                    onChange={(e) => setRrMax(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Margin Required */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Margin Required ({cur})</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={marginMin}
                    onChange={(e) => setMarginMin(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                  <span className="text-gray-600 font-bold">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={marginMax}
                    onChange={(e) => setMarginMax(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Net Premium */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider" title="Negative for Debit, Positive for Credit">Net Premium ({cur})</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={premiumMin}
                    onChange={(e) => setPremiumMin(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                    title="Negative for Debit, Positive for Credit"
                  />
                  <span className="text-gray-600 font-bold">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={premiumMax}
                    onChange={(e) => setPremiumMax(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                    title="Negative for Debit, Positive for Credit"
                  />
                </div>
              </div>
            </div>

            {/* Greeks range filters */}
            <div className="border-t border-borderClr/10 pt-3 mt-3 flex flex-col gap-2">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Greeks Filters</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                {/* Delta filter */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Delta Range</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filterMinDelta}
                      onChange={(e) => setFilterMinDelta(e.target.value)}
                      className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                    />
                    <span className="text-gray-600 font-bold">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filterMaxDelta}
                      onChange={(e) => setFilterMaxDelta(e.target.value)}
                      className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                    />
                  </div>
                </div>

                {/* Theta filter */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Min Theta ({cur}/day)</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={filterMinTheta}
                    onChange={(e) => setFilterMinTheta(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>

                {/* Gamma filter */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Max Gamma</span>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="Max"
                    value={filterMaxGamma}
                    onChange={(e) => setFilterMaxGamma(e.target.value)}
                    className="w-full bg-gray-950 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-accentCyan placeholder-gray-600"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        
        {scannedResults.length === 0 ? (
          <div className="bg-cardBg rounded-xl p-8 border border-borderClr/40 text-center text-gray-500 text-xs">
            No scan results generated. Configure constraints and click "Scan Symbol" to search.
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="bg-cardBg rounded-xl p-8 border border-borderClr/40 text-center text-gray-500 text-xs flex flex-col items-center gap-3">
            <span>No opportunities match the current range filters. Try clearing or expanding your criteria.</span>
            <button
              onClick={handleClearFilters}
              className="px-3.5 py-1.5 bg-accentBrand hover:bg-accentBrand/90 text-white font-bold rounded-lg text-xs transition-all"
            >
              Clear Range Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-borderClr/40 bg-cardBg">
            <div 
              className="max-h-[260px] overflow-y-auto scrollbar-thin"
              onScroll={handleTableScroll}
            >
              <table className="w-full text-left border-collapse text-xs table-layout-fixed">
                <thead>
                  <tr className="border-b border-borderClr bg-gray-900 text-gray-400 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                    <th 
                      className="py-3 px-4 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[14%]"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Rank & Name</span>
                        {sortField === 'name' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[9%]"
                      onClick={() => handleSort('expiry')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Expiry</span>
                        {sortField === 'expiry' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[5%]"
                      onClick={() => handleSort('distance')}
                    >
                      <div className="flex items-center gap-1">
                        <span>DIST</span>
                        {sortField === 'distance' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[7%]"
                      onClick={() => handleSort('pop')}
                    >
                      <div className="flex items-center gap-1">
                        <span>POP</span>
                        {sortField === 'pop' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[8%]"
                      onClick={() => handleSort('maxProfit')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Max Profit</span>
                        {sortField === 'maxProfit' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[8%]"
                      onClick={() => handleSort('maxLoss')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Max Loss</span>
                        {sortField === 'maxLoss' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[7%]"
                      onClick={() => handleSort('delta')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Delta (Δ)</span>
                        {sortField === 'delta' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[7%]"
                      onClick={() => handleSort('gamma')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Gamma (Γ)</span>
                        {sortField === 'gamma' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[7%]"
                      onClick={() => handleSort('theta')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Theta (Θ)</span>
                        {sortField === 'theta' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[7%]"
                      onClick={() => handleSort('riskReward')}
                    >
                      <div className="flex items-center gap-1">
                        <span>R:R</span>
                        {sortField === 'riskReward' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[8%]"
                      onClick={() => handleSort('margin')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Margin</span>
                        {sortField === 'margin' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none w-[10%]"
                      onClick={() => handleSort('netDebitCredit')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Debit/Credit</span>
                        {sortField === 'netDebitCredit' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-accentCyan" /> : <ChevronDown className="w-3 h-3 text-accentCyan" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 bg-gray-900 text-center select-none w-[8%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.map((sc, index) => {
                    const isSelected = selectedStrategy?.name === sc.name;
                    const originalRank = scannedResults.indexOf(sc) + 1;
                    return (
                      <tr 
                        key={index} 
                        onClick={() => handleSelectStrategy(sc)}
                        className={`border-b border-borderClr/20 hover:bg-gray-800/60 transition-all cursor-pointer ${
                          isSelected ? "bg-accentBrand/15 border-l-2 border-l-accentBrand" : ""
                        }`}
                      >
                        {/* Rank & Name */}
                        <td className="py-3.5 px-4 font-bold text-white flex flex-col gap-0.5">
                          <span className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${
                              isSelected 
                                ? "bg-accentBrand text-white border-accentBrand"
                                : "bg-accentBrand/10 text-accentBrand border border-accentBrand/25"
                            }`}>
                              #{originalRank}
                            </span>
                            {sc.name.split(" (")[0]}
                            {sc.symbol && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-accentCyan/15 text-accentCyan border border-accentCyan/30">
                                {sc.symbol}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-500 font-normal pl-7">{sc.description}</span>
                        </td>

                        {/* Expiry */}
                        <td className="py-3.5 px-3 font-semibold text-gray-300">
                          {sc.expiry}
                        </td>

                        {/* DIST */}
                        <td className="py-3.5 px-3 font-semibold text-gray-300">
                          {sc.distance}
                        </td>

                        {/* POP */}
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded-full font-bold text-accentCyan bg-accentCyan/10 border border-accentCyan/20">
                            {sc.pop}%
                          </span>
                        </td>

                        {/* Max Profit */}
                        <td className="py-3.5 px-3 text-greenBrand font-bold">
                          {typeof sc.maxProfit === 'number' && !isNaN(sc.maxProfit) ? `${cur}${sc.maxProfit.toLocaleString()}` : sc.maxProfit}
                        </td>

                        {/* Max Loss */}
                        <td className="py-3.5 px-3 text-redBrand font-bold">
                          {typeof sc.maxLoss === 'number' && !isNaN(sc.maxLoss) ? `${cur}${sc.maxLoss.toLocaleString()}` : sc.maxLoss}
                        </td>

                        {/* Delta */}
                        <td className="py-3.5 px-3 font-semibold text-gray-300">
                          {sc.delta !== undefined ? (sc.delta > 0 ? "+" : "") + sc.delta.toFixed(2) : "0.00"}
                        </td>

                        {/* Gamma */}
                        <td className="py-3.5 px-3 font-semibold text-gray-300 text-[11px]">
                          {sc.gamma !== undefined ? sc.gamma.toFixed(4) : "0.0000"}
                        </td>

                        {/* Theta */}
                        <td className={`py-3.5 px-3 font-semibold ${sc.theta >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                          {sc.theta !== undefined ? `${sc.theta >= 0 ? "+" : "-"}${cur}${Math.abs(Math.round(sc.theta))}` : `${cur}0`}
                        </td>

                        {/* R:R */}
                        <td className="py-3.5 px-3 font-semibold text-gray-300">
                          {getRiskRewardRatio(sc.maxProfit, sc.maxLoss)}
                        </td>

                        {/* Margin */}
                        <td className="py-3.5 px-3 text-yellow-500 font-bold">
                          {cur}{sc.margin != null && !isNaN(sc.margin) ? sc.margin.toLocaleString() : "0"}
                        </td>

                        {/* Debit / Credit */}
                        <td className="py-3.5 px-3">
                          <span className={`font-semibold ${sc.netDebitCredit >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                            {sc.netDebitCredit >= 0 ? "Credit: +" : "Debit: "}{cur}{sc.netDebitCredit != null && !isNaN(sc.netDebitCredit) ? Math.abs(sc.netDebitCredit).toLocaleString() : "0"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleLoad(sc); }}
                              className="px-2.5 py-1.5 bg-accentBrand/10 hover:bg-accentBrand/20 text-accentBrand text-xs font-bold rounded-lg border border-accentBrand/20 transition-all flex items-center gap-1"
                              title="Load to Sandbox"
                            >
                              <Play className="w-3.5 h-3.5 fill-accentBrand" />
                              <span>Sandbox</span>
                            </button>
                            {user?.role !== 'viewer' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleOpenTradeModal(sc); }}
                                className="px-2.5 py-1.5 bg-greenBrand/10 hover:bg-greenBrand/25 text-greenBrand text-xs font-bold rounded-lg border border-greenBrand/20 transition-all flex items-center gap-1"
                                title="Execute Live/Paper Trade"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>Trade</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Selected Strategy Payoff Diagram */}
      {selectedStrategy && selectedProjection && (
        <div className="glass-panel rounded-xl p-5 border border-borderClr/40 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-borderClr/20 pb-3">
            <div className="flex flex-col gap-1.5 text-left">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <LineChart className="w-4 h-4 text-accentCyan" />
                Payoff Analysis: {selectedStrategy.name}
              </h4>
              <div className="flex flex-col gap-1">
                <span className="text-sm md:text-base font-extrabold text-accentCyan">
                  {selectedStrategy.name} ({symbol})
                </span>
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {selectedStrategy.legs && selectedStrategy.legs.map((leg: any, idx: number) => {
                    const cur = getCurrencySymbol(symbol);
                    const actionColor = leg.action === 'BUY' ? 'text-green-400 bg-green-950/40 border-green-500/30' : 'text-red-400 bg-red-950/40 border-red-500/30';
                    return (
                      <span key={idx} className={`px-2.5 py-0.5 rounded text-[10px] md:text-xs font-bold border ${actionColor}`}>
                        {leg.action} {leg.quantity}x {leg.optionType === 'C' ? 'CE' : leg.optionType === 'P' ? 'PE' : 'FUT'} {cur}{leg.strike}
                        {leg.entryPrice !== undefined && leg.entryPrice !== null && leg.entryPrice !== 0 && ` @ ${cur}${leg.entryPrice}`}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-4 text-[10px] text-gray-400 font-semibold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-accentCyan rounded-full" /> T+{payoffDaysPassed} PnL</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-purple-500 rounded-full" /> Expiry PnL</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Payoff Curve Area */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="h-[280px] w-full relative bg-gray-950/20 rounded-xl p-2 border border-borderClr/10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedProjection.payoff} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="selectedProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="selectedLoss" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis type="number" dataKey="price" domain={['dataMin', 'dataMax']} stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val != null && !isNaN(val) ? val.toLocaleString() : ""} />
                    <RechartsTooltip content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const priceVal = payload[0].payload?.price;
                        const pnlCurrVal = payload[0].value;
                        const pnlExpVal = payload[1]?.value ?? 0;
                        return (
                          <div className="bg-gray-950/90 border border-borderClr p-2.5 rounded-lg text-xs flex flex-col gap-1 shadow-lg">
                            <span className="text-white font-extrabold">Asset Price: {priceVal != null ? priceVal.toLocaleString() : ""}</span>
                            <span className="text-accentCyan">T+{payoffDaysPassed} PnL: {pnlCurrVal != null ? (pnlCurrVal >= 0 ? "+" : "") + pnlCurrVal.toLocaleString() : "0"}</span>
                            <span className="text-purple-400">Expiry PnL: {pnlExpVal != null ? (pnlExpVal >= 0 ? "+" : "") + pnlExpVal.toLocaleString() : "0"}</span>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <ReferenceLine y={0} stroke="#4B5563" strokeWidth={1} />
                    {strategySpot != null && !isNaN(strategySpot) && isFinite(strategySpot) && (
                      <ReferenceLine x={strategySpot} stroke="#10B981" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: `Spot: ${strategySpot.toFixed(2)}`, fill: '#10B981', fontSize: 10, position: 'top', fontWeight: 'bold' }} />
                    )}
                    {selectedProjection.metrics.breakEvens.filter(be => be != null && !isNaN(be) && isFinite(be)).map((be) => (
                      <ReferenceLine key={be} x={be} stroke="#EAB308" strokeWidth={1} label={{ value: `BE: ${be}`, fill: '#F59E0B', fontSize: 9, position: 'bottom' }} />
                    ))}
                    <Area type="monotone" dataKey="pnlCurrent" stroke="#06B6D4" strokeWidth={2} fill="url(#selectedProfit)" dot={false} />
                    <Line type="monotone" dataKey="pnlExpiration" stroke="#A855F7" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Range Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-950/40 border border-borderClr/30 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-semibold uppercase flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-accentCyan" />
                      Target Date
                    </span>
                    <span className="text-white font-bold">T+{payoffDaysPassed} / {totalDays} Days</span>
                  </div>
                  <input
                    type="range" min={0} max={totalDays} value={payoffDaysPassed}
                    onChange={(e) => setPayoffDaysPassed(parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-accentCyan"
                  />
                </div>

                <div className="bg-gray-950/40 border border-borderClr/30 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-semibold uppercase flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-greenBrand" />
                      Volatility Shift
                    </span>
                    <span className={`font-bold ${payoffIvOffset > 0 ? "text-greenBrand" : payoffIvOffset < 0 ? "text-redBrand" : "text-white"}`}>
                      {payoffIvOffset > 0 ? "+" : ""}{payoffIvOffset}%
                    </span>
                  </div>
                  <input
                    type="range" min={-50} max={50} value={payoffIvOffset}
                    onChange={(e) => setPayoffIvOffset(parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-greenBrand"
                  />
                </div>
              </div>

              {/* Theoretical Legs Breakdown */}
              <div className="flex flex-col gap-2.5 mt-2 bg-gray-950/20 border border-borderClr/10 rounded-xl p-4">
                <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-accentCyan" />
                  Theoretical Legs Breakdown
                </h5>
                <div className="flex flex-wrap gap-3">
                  {selectedStrategy.legs.map((leg, idx) => {
                    const isBuy = leg.action === 'BUY';
                    const typeLabel = leg.optionType === 'C' ? 'CE' : leg.optionType === 'P' ? 'PE' : 'FUT';
                    return (
                      <div 
                        key={idx}
                        className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                          isBuy 
                            ? 'bg-greenBrand/5 border-greenBrand/25 text-greenBrand' 
                            : 'bg-redBrand/5 border-redBrand/25 text-redBrand'
                        }`}
                      >
                        {isBuy ? 'Buy' : 'Sell'} {leg.quantity}x {leg.strike} {typeLabel} @ {cur}{leg.entryPrice.toFixed(2)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Metrics Summary side panel */}
            <div className="bg-gray-950/30 border border-borderClr/30 rounded-xl p-4 flex flex-col gap-3.5">
              <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-borderClr/20 pb-2">Analysis Summary</h5>
              
              <div className="flex flex-col gap-2 border-b border-borderClr/10 pb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Max Profit:</span>
                  <span className={`font-bold ${selectedProjection.metrics.maxProfit === 'Unlimited' ? 'text-greenBrand' : 'text-white'}`}>
                    {typeof selectedProjection.metrics.maxProfit === 'number' ? `${cur}${selectedProjection.metrics.maxProfit.toLocaleString()}` : selectedProjection.metrics.maxProfit}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Max Loss:</span>
                  <span className="font-bold text-redBrand">
                    {typeof selectedProjection.metrics.maxLoss === 'number' ? `${cur}${selectedProjection.metrics.maxLoss.toLocaleString()}` : selectedProjection.metrics.maxLoss}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Risk:Reward Ratio:</span>
                  <span className="font-bold text-white">
                    {getRiskRewardRatio(selectedProjection.metrics.maxProfit, selectedProjection.metrics.maxLoss)}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">POP (Prob. of Profit):</span>
                  <span className="font-bold text-accentCyan">{selectedProjection.metrics.pop}%</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Margin Required:</span>
                  <span className="font-bold text-yellow-500">{cur}{selectedProjection.metrics.marginRequirement.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Debit / Credit:</span>
                  <span className={`font-bold ${selectedProjection.metrics.netDebitCredit >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                    {selectedProjection.metrics.netDebitCredit >= 0 ? "Credit: +" : "Debit: "}{cur}{Math.abs(selectedProjection.metrics.netDebitCredit).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <span className="text-gray-500 font-semibold">Break Evens:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedProjection.metrics.breakEvens.length === 0 ? (
                    <span className="text-gray-500 text-[10px]">None</span>
                  ) : (
                    selectedProjection.metrics.breakEvens.map((be) => (
                      <span key={be} className="px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] rounded font-bold">
                        {cur}{be.toLocaleString()}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-borderClr/10">
                <button
                  onClick={() => handleLoad(selectedStrategy)}
                  className="w-full py-2 bg-accentBrand text-white text-xs font-extrabold rounded-lg hover:bg-accentBrand/90 transition-all flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                  <span>Send to Sandbox</span>
                </button>
                {user?.role !== 'viewer' && (
                  <button
                    onClick={() => handleOpenTradeModal(selectedStrategy)}
                    className="w-full py-2 bg-greenBrand/10 hover:bg-greenBrand/20 text-greenBrand border border-greenBrand/35 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Execute Strategy / Trade</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade Execution Modal */}
      {tradeModalOpen && tradeStrategy && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-borderClr/40 p-6 flex flex-col gap-5 shadow-2xl bg-gray-950/95">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-borderClr/25 pb-3">
              <div className="flex flex-col gap-0.5">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-greenBrand" />
                  Execute Strategy Orders
                </h4>
                <span className="text-[10px] text-gray-500 font-semibold">{tradeStrategy.name}</span>
              </div>
              <button 
                onClick={() => setTradeModalOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Broker Selection Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Select Execution Broker</span>
              <div className="grid grid-cols-3 gap-2">
                {/* Paper Trading */}
                <button
                  onClick={() => setSelectedBroker('paper')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedBroker === 'paper'
                      ? "bg-accentCyan/15 border-accentCyan text-white"
                      : "bg-gray-950/60 border-borderClr/40 text-gray-500 hover:text-white hover:border-gray-700"
                  }`}
                >
                  <span className="text-xs font-bold">Paper Trade</span>
                  <span className="text-[8px] text-gray-500 leading-tight">Simulated execution with local tracking</span>
                </button>

                {/* Dhan API */}
                <button
                  onClick={() => setSelectedBroker('dhan')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedBroker === 'dhan'
                      ? "bg-greenBrand/15 border-greenBrand text-white"
                      : "bg-gray-950/60 border-borderClr/40 text-gray-500 hover:text-white hover:border-gray-700"
                  }`}
                >
                  <span className="text-xs font-bold">Dhan API</span>
                  <span className="text-[8px] text-gray-500 leading-tight">Live derivative trading via DhanHQ F&O</span>
                </button>

                {/* Kotak Neo */}
                <button
                  onClick={() => setSelectedBroker('kotak')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedBroker === 'kotak'
                      ? "bg-yellow-500/15 border-yellow-500 text-white"
                      : "bg-gray-950/60 border-borderClr/40 text-gray-500 hover:text-white hover:border-gray-700"
                  }`}
                >
                  <span className="text-xs font-bold">Kotak Neo</span>
                  <span className="text-[8px] text-gray-500 leading-tight">Live execution via Kotak Neo API</span>
                </button>
              </div>
            </div>

            {/* Leg Breakdown */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Strategy Legs Breakdown</span>
              <div className="bg-gray-950/50 border border-borderClr/25 rounded-xl p-3 flex flex-col gap-2 max-h-[140px] overflow-y-auto scrollbar-thin">
                {tradeStrategy.legs.map((leg, idx) => {
                  const isBuy = leg.action === 'BUY';
                  const typeLabel = leg.optionType === 'C' ? 'CE' : leg.optionType === 'P' ? 'PE' : 'FUT';
                  const modalCur = getCurrencySymbol(symbol);
                  return (
                    <div 
                      key={idx}
                      className="flex justify-between items-center text-xs border-b border-borderClr/10 pb-1.5 last:border-b-0 last:pb-0"
                    >
                      <span className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {leg.action}
                        </span>
                        <span className="font-bold text-white">{leg.quantity}x {leg.strike} {typeLabel}</span>
                      </span>
                      <span className="text-gray-400">Entry: {modalCur}{leg.entryPrice.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Execution Footer */}
            <div className="flex gap-3 border-t border-borderClr/25 pt-4 mt-1">
              <button
                onClick={() => setTradeModalOpen(false)}
                className="flex-1 py-2 border border-borderClr/50 hover:bg-gray-900 text-gray-300 font-bold rounded-lg text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteTrade}
                disabled={isExecutingTrade}
                className={`flex-1 py-2 rounded-lg text-xs font-bold text-black flex items-center justify-center gap-1.5 transition-all ${
                  selectedBroker === 'paper' 
                    ? 'bg-accentCyan hover:bg-accentCyan/90' 
                    : selectedBroker === 'dhan' 
                      ? 'bg-greenBrand hover:bg-greenBrand/90' 
                      : 'bg-yellow-500 hover:bg-yellow-500/90'
                } disabled:opacity-50`}
              >
                {isExecutingTrade ? (
                  <span>Executing...</span>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Execute {selectedBroker === 'paper' ? 'Paper' : `on ${selectedBroker.toUpperCase()}`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
