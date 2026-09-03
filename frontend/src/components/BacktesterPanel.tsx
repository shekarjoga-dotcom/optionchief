import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { 
  Play, Plus, Trash2, TrendingUp, Calendar, 
  Activity, AlertCircle, Download
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area
} from 'recharts';
import { projectStrategy, bsPricing, getCurrencySymbol } from '../utils/optionsMath';
import type { StrategyLeg } from '../utils/optionsMath';
import type { AlertRule } from '../types';

import { BACKEND_URL } from '../config';

interface OptionLeg {
  id: string;
  action: 'BUY' | 'SELL';
  optionType: 'C' | 'P' | 'F';
  strikeOffset: number;
  quantity: number;
}

interface StrategyPreset {
  name: string;
  legs: Omit<OptionLeg, 'id'>[];
}

const STRATEGY_PRESETS: Record<string, StrategyPreset> = {
  "straddle_short": {
    name: "Short Straddle (ATM)",
    legs: [
      { action: "SELL", optionType: "C", strikeOffset: 0, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: 0, quantity: 1 }
    ]
  },
  "strangle_short": {
    name: "Short Strangle (OTM)",
    legs: [
      { action: "SELL", optionType: "C", strikeOffset: 200, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: -200, quantity: 1 }
    ]
  },
  "jade_lizard": {
    name: "Jade Lizard (No Upside Risk)",
    legs: [
      { action: "SELL", optionType: "P", strikeOffset: -200, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 200, quantity: 1 },
      { action: "BUY", optionType: "C", strikeOffset: 300, quantity: 1 }
    ]
  },
  "twisted_jade_lizard": {
    name: "Twisted Jade Lizard (No Downside Risk)",
    legs: [
      { action: "SELL", optionType: "C", strikeOffset: 200, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: -200, quantity: 1 },
      { action: "BUY", optionType: "P", strikeOffset: -300, quantity: 1 }
    ]
  },
  "short_iron_condor": {
    name: "Short Iron Condor (Credit)",
    legs: [
      { action: "BUY", optionType: "P", strikeOffset: -300, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: -200, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 200, quantity: 1 },
      { action: "BUY", optionType: "C", strikeOffset: 300, quantity: 1 }
    ]
  },
  "long_iron_condor": {
    name: "Long Iron Condor (Breakout Debit)",
    legs: [
      { action: "SELL", optionType: "P", strikeOffset: -300, quantity: 1 },
      { action: "BUY", optionType: "P", strikeOffset: -200, quantity: 1 },
      { action: "BUY", optionType: "C", strikeOffset: 200, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 300, quantity: 1 }
    ]
  },
  "call_condor": {
    name: "Call Condor",
    legs: [
      { action: "BUY", optionType: "C", strikeOffset: -200, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: -100, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 100, quantity: 1 },
      { action: "BUY", optionType: "C", strikeOffset: 200, quantity: 1 }
    ]
  },
  "put_condor": {
    name: "Put Condor",
    legs: [
      { action: "BUY", optionType: "P", strikeOffset: -200, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: -100, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: 100, quantity: 1 },
      { action: "BUY", optionType: "P", strikeOffset: 200, quantity: 1 }
    ]
  },
  "iron_condor": {
    name: "Iron Condor",
    legs: [
      { action: "BUY", optionType: "P", strikeOffset: -300, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: -200, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 200, quantity: 1 },
      { action: "BUY", optionType: "C", strikeOffset: 300, quantity: 1 }
    ]
  },
  "ratio_iron_condor_12": {
    name: "Ratio Iron Condor (1:2)",
    legs: [
      { action: "BUY", optionType: "P", strikeOffset: -400, quantity: 2 },
      { action: "SELL", optionType: "P", strikeOffset: -200, quantity: 2 },
      { action: "SELL", optionType: "C", strikeOffset: 200, quantity: 1 },
      { action: "BUY", optionType: "C", strikeOffset: 600, quantity: 1 }
    ]
  },
  "bull_call_spread": {
    name: "Bull Call Spread",
    legs: [
      { action: "BUY", optionType: "C", strikeOffset: 0, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 100, quantity: 1 }
    ]
  },
  "bear_put_spread": {
    name: "Bear Put Spread",
    legs: [
      { action: "BUY", optionType: "P", strikeOffset: 0, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: -100, quantity: 1 }
    ]
  },
  "ratio_butterfly_132_call": {
    name: "1:3:2 Call Ratio Fly",
    legs: [
      { action: "BUY", optionType: "C", strikeOffset: -200, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 0, quantity: 3 },
      { action: "BUY", optionType: "C", strikeOffset: 100, quantity: 2 }
    ]
  },
  "ratio_butterfly_132_put": {
    name: "1:3:2 Put Ratio Fly",
    legs: [
      { action: "BUY", optionType: "P", strikeOffset: -100, quantity: 2 },
      { action: "SELL", optionType: "P", strikeOffset: 0, quantity: 3 },
      { action: "BUY", optionType: "P", strikeOffset: 200, quantity: 1 }
    ]
  },
  "butterfly_call": {
    name: "Call Butterfly (ATM)",
    legs: [
      { action: "BUY", optionType: "C", strikeOffset: -100, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 0, quantity: 2 },
      { action: "BUY", optionType: "C", strikeOffset: 100, quantity: 1 }
    ]
  },
  "butterfly_put": {
    name: "Put Butterfly (ATM)",
    legs: [
      { action: "BUY", optionType: "P", strikeOffset: -100, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: 0, quantity: 2 },
      { action: "BUY", optionType: "P", strikeOffset: 100, quantity: 1 }
    ]
  },
  "butterfly_iron": {
    name: "Iron Butterfly (ATM)",
    legs: [
      { action: "BUY", optionType: "P", strikeOffset: -100, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: 0, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 0, quantity: 1 },
      { action: "BUY", optionType: "C", strikeOffset: 100, quantity: 1 }
    ]
  },
  "synthetic_long": {
    name: "Synthetic Long Stock",
    legs: [
      { action: "BUY", optionType: "C", strikeOffset: 0, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: 0, quantity: 1 }
    ]
  },
  "synthetic_short": {
    name: "Synthetic Short Stock",
    legs: [
      { action: "SELL", optionType: "C", strikeOffset: 0, quantity: 1 },
      { action: "BUY", optionType: "P", strikeOffset: 0, quantity: 1 }
    ]
  },
  "synthetic_long_call": {
    name: "Synthetic Long Call (Future + Put)",
    legs: [
      { action: "BUY", optionType: "F", strikeOffset: 0, quantity: 1 },
      { action: "BUY", optionType: "P", strikeOffset: 0, quantity: 1 }
    ]
  },
  "synthetic_long_put": {
    name: "Synthetic Long Put (Future + Call)",
    legs: [
      { action: "SELL", optionType: "F", strikeOffset: 0, quantity: 1 },
      { action: "BUY", optionType: "C", strikeOffset: 0, quantity: 1 }
    ]
  },
  "protective_put": {
    name: "Protective Put (Married Put)",
    legs: [
      { action: "BUY", optionType: "F", strikeOffset: 0, quantity: 1 },
      { action: "BUY", optionType: "P", strikeOffset: -100, quantity: 1 }
    ]
  },
  "protective_call": {
    name: "Protective Call (Covered Short)",
    legs: [
      { action: "SELL", optionType: "F", strikeOffset: 0, quantity: 1 },
      { action: "BUY", optionType: "C", strikeOffset: 100, quantity: 1 }
    ]
  },
  "zero_cost_collar": {
    name: "Zero-Cost Collar",
    legs: [
      { action: "BUY", optionType: "F", strikeOffset: 0, quantity: 1 },
      { action: "BUY", optionType: "P", strikeOffset: -200, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 200, quantity: 1 }
    ]
  },
  "put_spread_collar": {
    name: "Put Spread Collar",
    legs: [
      { action: "BUY", optionType: "F", strikeOffset: 0, quantity: 1 },
      { action: "BUY", optionType: "P", strikeOffset: -100, quantity: 1 },
      { action: "SELL", optionType: "P", strikeOffset: -300, quantity: 1 },
      { action: "SELL", optionType: "C", strikeOffset: 200, quantity: 1 }
    ]
  },
  "rsi_scanner": {
    name: "⚡ RSI Momentum Scalper (Price Action Breakout)",
    legs: []
  }
};

const OPTIMIZATION_PROMPTS: Record<string, string> = {
  "rsi_scanner": "Optimize the RSI Momentum Scalper by sweeping RSI Periods (2 to 14), threshold levels (80/20 to 60/40), Moneyness (ATM/OTM), and TP/SL. Goal: Maximize Win Rate and Net Return.",
  "protective_put": "Optimize Protective Put by sweeping Stop Loss / Max Loss Caps (₹5k to ₹20k) and Entry Days. Goal: Minimize Max Drawdown while keeping upside returns.",
  "protective_call": "Optimize Protective Call by sweeping Stop Loss / Max Loss Caps (₹5k to ₹20k) and Entry Days. Goal: Minimize Max Drawdown.",
  "straddle_short": "Optimize the Short Straddle by sweeping Stop Loss from 10% to 50% (increments of 10%) and Entry Times from 09:20 to 10:15. Goal: Maximize win rate and minimize Max Drawdown.",
  "short_iron_condor": "Optimize the Short Iron Condor (Credit) by sweeping wing widths (100 to 400 points) and entry days of the week. Goal: Maximize Profit Factor while keeping drawdowns low.",
  "long_iron_condor": "Optimize the Long Iron Condor (Breakout Debit) by sweeping inner/outer strike offsets and entry days. Goal: Maximize Net Return on breakout moves.",
  "call_condor": "Optimize the Call Condor by sweeping strike offsets and exit days. Goal: Maximize Win Rate.",
  "put_condor": "Optimize the Put Condor by sweeping strike offsets and exit days. Goal: Maximize Win Rate.",
  "strangle_short": "Optimize the Short Strangle by sweeping OTM strike offsets and Stop Loss levels (20% to 60%). Goal: Find the highest profit factor while keeping net return positive.",
  "jade_lizard": "Optimize the Jade Lizard by sweeping OTM Put offsets and Call spread wing widths. Goal: Maximize Profit Factor while eliminating upside risk.",
  "twisted_jade_lizard": "Optimize the Twisted Jade Lizard by sweeping OTM Call offsets and Put spread wing widths. Goal: Maximize Profit Factor while eliminating downside risk.",
  "iron_condor": "Optimize the Iron Condor by sweeping wing widths (100 to 300 points) and entry days of the week (Monday, Tuesday, Thursday). Goal: Find the configuration that minimizes Max Drawdown.",
  "ratio_iron_condor_12": "Optimize the Ratio Iron Condor (1:2) by sweeping Call/Put spreads offsets, take profit targets, and stop loss levels. Goal: Maximize profit factor.",
  "bull_call_spread": "Optimize the Bull Call Spread by sweeping Stop Loss levels (10% to 40%) and Entry Times. Goal: Find the configuration that maximizes Sharpe ratio.",
  "bear_put_spread": "Optimize the Bear Put Spread by sweeping Stop Loss levels (10% to 40%) and Entry Times. Goal: Find the configuration that maximizes Sharpe ratio.",
  "ratio_butterfly_132_call": "Optimize the 1:3:2 Call Ratio Fly by sweeping Exit Times and Take Profit levels. Goal: Maximize Net Profit Factor.",
  "ratio_butterfly_132_put": "Optimize the 1:3:2 Put Ratio Fly by sweeping Exit Times and Take Profit levels. Goal: Maximize Net Profit Factor.",
  "butterfly_call": "Optimize the Call Butterfly (1:2:1) by sweeping Stop Loss levels (15% to 45%) and entry days. Goal: Find the configuration that maximizes Sharpe Ratio.",
  "butterfly_put": "Optimize the Put Butterfly (1:2:1) by sweeping Stop Loss levels (15% to 45%) and entry days. Goal: Find the configuration that maximizes Sharpe Ratio.",
  "butterfly_iron": "Optimize the Iron Butterfly by sweeping Stop Loss levels (10% to 40%) and entry times. Goal: Find the configuration that minimizes Max Drawdown.",
  "synthetic_long": "Optimize the Synthetic Long by sweeping entry times and underlying target offsets. Goal: Maximize Sharpe Ratio.",
  "synthetic_short": "Optimize the Synthetic Short by sweeping entry times and underlying target offsets. Goal: Maximize Sharpe Ratio.",
  "synthetic_long_call": "Optimize the Synthetic Long Call by sweeping Put strike offsets and Stop Loss levels. Goal: Maximize Profit Factor.",
  "synthetic_long_put": "Optimize the Synthetic Long Put by sweeping Call strike offsets and Stop Loss levels. Goal: Maximize Profit Factor.",
  "zero_cost_collar": "Optimize the Zero-Cost Collar by sweeping Call/Put strike offsets and Entry Days. Goal: Maximize win rate.",
  "put_spread_collar": "Optimize the Put Spread Collar by sweeping wing widths and Exit days. Goal: Maximize Net Return."
};

const SYMBOL_OPTIONS = [
  "NIFTY", "BANKNIFTY", "SENSEX", "FINNIFTY", "MIDCPNIFTY", 
  "RELIANCE", "SBIN", "ITC", 
  "CRUDEOIL", "SILVER", "GOLD", 
  "SPY", "AAPL", "TSLA",
  "BTC", "ETH"
];

const formatErrorDetail = (detail: any, fallback: string): string => {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => {
      const loc = d.loc ? d.loc.filter((x: any) => x !== 'body').join('.') : '';
      return `${loc ? loc + ': ' : ''}${d.msg || JSON.stringify(d)}`;
    }).join(' | ');
  }
  return JSON.stringify(detail);
};

const STRIKE_ROUND_INTERVALS: Record<string, number> = {
  "NIFTY": 50,
  "BANKNIFTY": 100,
  "SENSEX": 100,
  "FINNIFTY": 100,
  "MIDCPNIFTY": 50,
  "RELIANCE": 10,
  "SBIN": 5,
  "ITC": 2.5,
  "GOLD": 1000,
  "GOLDM": 1000,
  "SILVER": 1000,
  "SILVERM": 1000,
  "CRUDEOIL": 50,
  "CRUDEOILM": 50,
  "SPY": 1,
  "AAPL": 1,
  "TSLA": 1
};

const DEFAULT_STRIKE_WIDTHS: Record<string, number[]> = {
  "NIFTY": [50, 100, 150, 200, 250, 300, 350, 400],
  "BANKNIFTY": [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000],
  "SENSEX": [100, 200, 300, 400, 500, 600, 700, 800, 1000],
  "FINNIFTY": [100, 200, 300],
  "MIDCPNIFTY": [50, 100, 150],
  "RELIANCE": [10, 20, 30, 50],
  "SBIN": [5, 10, 15, 20],
  "ITC": [2.5, 5, 7.5, 10],
  "GOLD": [1000, 2000, 3000, 5000, 10000],
  "GOLDM": [1000, 2000, 3000, 5000, 10000],
  "SILVER": [1000, 2000, 3000, 5000, 10000],
  "SILVERM": [1000, 2000, 3000, 5000, 10000],
  "CRUDEOIL": [50, 100, 150, 200],
  "CRUDEOILM": [50, 100, 150, 200],
  "SPY": [1, 2, 3, 5, 10],
  "AAPL": [1, 2, 3, 5, 10],
  "TSLA": [1, 2, 3, 5, 10]
};

const DEFAULT_DIRECTION_OFFSETS: Record<string, { label: string; offset: number }[]> = {
  "NIFTY": [
    { label: "-300 P-OTM", offset: -300 },
    { label: "-200 P-OTM", offset: -200 },
    { label: "-100 P-OTM", offset: -100 },
    { label: "-50 P-OTM", offset: -50 },
    { label: "ATM (0)", offset: 0 },
    { label: "+50 C-OTM", offset: 50 },
    { label: "+100 C-OTM", offset: 100 },
    { label: "+200 C-OTM", offset: 200 },
    { label: "+300 C-OTM", offset: 300 }
  ],
  "BANKNIFTY": [
    { label: "-600 P-OTM", offset: -600 },
    { label: "-400 P-OTM", offset: -400 },
    { label: "-200 P-OTM", offset: -200 },
    { label: "-100 P-OTM", offset: -100 },
    { label: "ATM (0)", offset: 0 },
    { label: "+100 C-OTM", offset: 100 },
    { label: "+200 C-OTM", offset: 200 },
    { label: "+400 C-OTM", offset: 400 },
    { label: "+600 C-OTM", offset: 600 }
  ],
  "SENSEX": [
    { label: "-500 P-OTM", offset: -500 },
    { label: "-300 P-OTM", offset: -300 },
    { label: "-100 P-OTM", offset: -100 },
    { label: "ATM (0)", offset: 0 },
    { label: "+100 C-OTM", offset: 100 },
    { label: "+300 C-OTM", offset: 300 },
    { label: "+500 C-OTM", offset: 500 }
  ],
  "FINNIFTY": [
    { label: "-200 P-OTM", offset: -200 },
    { label: "-100 P-OTM", offset: -100 },
    { label: "ATM (0)", offset: 0 },
    { label: "+100 C-OTM", offset: 100 },
    { label: "+200 C-OTM", offset: 200 }
  ]
};

const getOffsetOptionsForSymbol = (symbol: string, currentOffset: number) => {
  const interval = STRIKE_ROUND_INTERVALS[symbol.toUpperCase()] || 50;
  const list: number[] = [];
  for (let i = -20; i <= 20; i++) {
    list.push(i * interval);
  }
  if (!list.includes(currentOffset)) {
    list.push(currentOffset);
  }
  return list.sort((a, b) => a - b);
};

const parseDurationValue = (durStr: string | undefined): number => {
  if (!durStr || durStr === "-") return -1;
  const dayMatch = durStr.match(/(\d+(?:\.\d+)?)\s*D/i);
  if (dayMatch) return parseFloat(dayMatch[1]) * 24 * 60;
  
  let totalMins = 0;
  const hourMatch = durStr.match(/(\d+)\s*h/i);
  const minMatch = durStr.match(/(\d+)\s*m/i);
  if (hourMatch) totalMins += parseInt(hourMatch[1]) * 60;
  if (minMatch) totalMins += parseInt(minMatch[1]);
  return totalMins > 0 ? totalMins : parseFloat(durStr) || 0;
};

export const BacktesterPanel: React.FC = () => {
  const { symbol, token, underlying, saveAlertRule } = useStore();

  const getStrategyTypeFromPreset = (preset: string) => {
    if (preset.includes("iron_condor")) return "IRON CONDOR";
    if (preset.includes("butterfly_iron")) return "IRON BUTTERFLY";
    if (preset.includes("ratio_butterfly_132_call")) return "1:3:2 CALL RATIO FLY";
    if (preset.includes("ratio_butterfly_132_put")) return "1:3:2 PUT RATIO FLY";
    if (preset.includes("straddle_short")) return "IRON BUTTERFLY";
    if (preset.includes("strangle_short")) return "IRON CONDOR";
    if (preset.includes("protective_put")) return "PROTECTIVE PUT";
    if (preset.includes("zero_cost_collar")) return "ZERO COST COLLAR";
    if (preset.includes("put_spread_collar")) return "PUT SPREAD COLLAR";
    return "1:3:2";
  };

  const handleSaveAsScannerRule = async () => {
    if (!metrics) {
      alert("No backtest metrics found. Run a backtest first.");
      return;
    }
    
    const strategyType = getStrategyTypeFromPreset(optimizerActivePreset || "");
    const minPop = metrics.winRate || 50;
    const minRR = Math.max(1.0, Math.round((metrics.profitFactor || 1.5) * 10) / 10);
    const maxLoss = Math.round(initialCapital * ((metrics.maxDrawdown || 10) / 100)) || 1000;

    const newRule: AlertRule = {
      id: Math.random().toString(36).substring(2, 9),
      strategyType,
      symbol: backtestSymbol,
      expiry: "ALL",
      minPop,
      minRR,
      maxLoss,
      active: true,
      autoExecute: false
    };

    try {
      await saveAlertRule(newRule);
      const cur = getCurrencySymbol(backtestSymbol);
      alert(
        `Successfully saved backtest configuration as active scanner rule!\n\n` +
        `Strategy: ${strategyType}\n` +
        `Asset: ${backtestSymbol}\n` +
        `Min POP: ${minPop}%\n` +
        `Min R:R: 1:${minRR}\n` +
        `Max Loss: ${cur}${maxLoss.toLocaleString()}`
      );
    } catch (err: any) {
      alert(`Failed to save scanner rule: ${err.message || err}`);
    }
  };
  
  // Configuration States
  const [backtestSymbol, setBacktestSymbol] = useState<string>(symbol || "NIFTY");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [slippage, setSlippage] = useState<number>(50); // flat cost per lot/leg
  const [entryDays, setEntryDays] = useState<number[]>([1]); // Default Tuesday = 1

  // Intraday backtest states
  const [backtestType, setBacktestType] = useState<'EOD' | 'INTRADAY'>('EOD');
  const [entryTime, setEntryTime] = useState<string>("09:20");
  const [exitTime, setExitTime] = useState<string>("15:15");
  const [intradayInterval, setIntradayInterval] = useState<number>(5);
  const [expiryType, setExpiryType] = useState<string>("weekly");

  // RSI Scanner Strategy States
  const [strategyType, setStrategyType] = useState<'STANDARD' | 'RSI_SCANNER'>('STANDARD');
  const [rsiPeriod, setRsiPeriod] = useState<number>(3);
  const [rsiUpper, setRsiUpper] = useState<number>(80);
  const [rsiLower, setRsiLower] = useState<number>(20);
  const [rsiMoneyness, setRsiMoneyness] = useState<string>("ATM");
  const [rsiLots, setRsiLots] = useState<number>(1);
  const [rsiTpPct, setRsiTpPct] = useState<number>(30);
  const [rsiSlPct, setRsiSlPct] = useState<number>(15);

  // RSI Optimizer Sweep States
  const [optRsiPeriodRange, setOptRsiPeriodRange] = useState<number[]>([2, 3, 5, 7, 14]);
  const [optRsiLevelsRange, setOptRsiLevelsRange] = useState<string[]>(["85/15", "80/20", "75/25", "70/30", "60/40"]);
  const [optRsiMoneynessRange, setOptRsiMoneynessRange] = useState<string[]>(["ATM", "OTM1", "OTM2"]);

  // Listen for pre-fill requests from RSI Scanner panel
  const checkRsiPrefill = () => {
    const saved = localStorage.getItem('OC_RSI_BACKTEST_CONFIG');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.symbol) setBacktestSymbol(p.symbol);
        if (p.rsi_period) setRsiPeriod(p.rsi_period);
        if (p.rsi_upper) setRsiUpper(p.rsi_upper);
        if (p.rsi_lower) setRsiLower(p.rsi_lower);
        if (p.moneyness) setRsiMoneyness(p.moneyness);
        if (p.tp_pct) setRsiTpPct(p.tp_pct);
        if (p.sl_pct) setRsiSlPct(p.sl_pct);
        if (p.lot_size) setRsiLots(p.lot_size);
        setStrategyType('RSI_SCANNER');
        setBacktestType('INTRADAY');
        setOptimizerActivePreset('rsi_scanner');
        localStorage.removeItem('OC_RSI_BACKTEST_CONFIG');
      } catch (e) {
        console.error("Error loading pre-filled RSI config:", e);
      }
    }
  };

  useEffect(() => {
    checkRsiPrefill();
    window.addEventListener('storage', checkRsiPrefill);
    window.addEventListener('hashchange', checkRsiPrefill);
    window.addEventListener('rsi_backtest_load', checkRsiPrefill);
    return () => {
      window.removeEventListener('storage', checkRsiPrefill);
      window.removeEventListener('hashchange', checkRsiPrefill);
      window.removeEventListener('rsi_backtest_load', checkRsiPrefill);
    };
  }, []);

  // Validate and adjust expiry cycle when underlying symbol changes
  useEffect(() => {
    const sym = backtestSymbol.toUpperCase();
    const isCrypto = ["BTC", "ETH", "SOL"].includes(sym);
    const isIndianStock = ["RELIANCE", "SBIN", "ITC"].includes(sym);

    if (isIndianStock) {
      setExpiryType("monthly");
    } else {
      if (!isCrypto && ["daily", "+2 day", "+3 day", "+4 day", "+5 day", "+6 day"].includes(expiryType)) {
        setExpiryType("weekly");
      }
    }
  }, [backtestSymbol]);
  
  // Leg SL/TP
  const [legStopLossPct, setLegStopLossPct] = useState<string>("");
  const [legTakeProfitPct, setLegTakeProfitPct] = useState<string>("");

  // Portfolio SL/TP (absolute)
  const [portfolioStopLoss, setPortfolioStopLoss] = useState<string>("");
  const [portfolioTakeProfit, setPortfolioTakeProfit] = useState<string>("");

  // Percentage-based Portfolio Portfolio SL/TP Sliders
  const [takeProfitPct, setTakeProfitPct] = useState<number>(20);
  const [stopLossPct, setStopLossPct] = useState<number>(0);
  const [stopLossType, setStopLossType] = useState<'pct_max_loss' | 'pct_max_profit'>('pct_max_loss');

  // Results Sub-Tab
  const [resultsSubTab, setResultsSubTab] = useState<'backtest' | 'optimizer'>('backtest');

  // Optimizer States
  const [optimizerActivePreset, setOptimizerActivePreset] = useState<string>("straddle_short");
  const [optimizationPrompt, setOptimizationPrompt] = useState<string>(OPTIMIZATION_PROMPTS["straddle_short"] || "");
  const [optTakeProfitRange, setOptTakeProfitRange] = useState<number[]>([10, 20, 30, 50]);
  const [optStopLossRange, setOptStopLossRange] = useState<number[]>([10, 20, 30, 50]);
  const [optEntryTimeRange, setOptEntryTimeRange] = useState<string[]>(["09:20", "09:45", "10:15"]);
  const [optEntryDaysRange, setOptEntryDaysRange] = useState<number[]>([0, 1, 2, 3, 4]);
  const [optObjective, setOptObjective] = useState<string>("netPnL");
  
  const [optimizationResults, setOptimizationResults] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  // Optimizer Sweeps Strike Spacing State
  const [optStrikeWidthRange, setOptStrikeWidthRange] = useState<number[]>([]);
  // Optimizer Sweeps Direction / OTM Placement State
  const [optDirectionOffsetRange, setOptDirectionOffsetRange] = useState<number[]>([0]);

  // Sorting states
  const [optSortField, setOptSortField] = useState<string>("rank");
  const [optSortAsc, setOptSortAsc] = useState<boolean>(true);

  // Sorting helper
  const handleSort = (field: string) => {
    if (optSortField === field) {
      setOptSortAsc(prev => !prev);
    } else {
      setOptSortField(field);
      // For drawdown, ascending is usually the desired default (lower DD first)
      // For others, descending (higher value first)
      setOptSortAsc(field === 'maxDrawdown' || field === 'rank');
    }
  };

  // Sorted results
  const sortedOptimizationResults = useMemo(() => {
    if (!optimizationResults) return [];
    const sorted = [...optimizationResults];
    
    if (optSortField === "rank") {
      return optSortAsc ? sorted : sorted.reverse();
    }
    
    sorted.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;
      
      if (optSortField === 'stopLoss') {
        valA = a.parameters.stopLossPct;
        valB = b.parameters.stopLossPct;
      } else if (optSortField === 'takeProfit') {
        valA = a.parameters.takeProfitPct;
        valB = b.parameters.takeProfitPct;
      } else if (optSortField === 'netReturn') {
        valA = a.metrics.netPnL;
        valB = b.metrics.netPnL;
      } else if (optSortField === 'winRate') {
        valA = a.metrics.winRate;
        valB = b.metrics.winRate;
      } else if (optSortField === 'maxDrawdown') {
        valA = a.metrics.maxDrawdown;
        valB = b.metrics.maxDrawdown;
      } else if (optSortField === 'profitFactor') {
        valA = a.metrics.profitFactor;
        valB = b.metrics.profitFactor;
        if (valA === "Unlimited") valA = Infinity;
        if (valB === "Unlimited") valB = Infinity;
      } else if (optSortField === 'strikeWidth') {
        valA = a.parameters.strikeWidth ?? -1;
        valB = b.parameters.strikeWidth ?? -1;
      } else if (optSortField === 'directionOffset') {
        valA = a.parameters.directionOffset ?? 0;
        valB = b.parameters.directionOffset ?? 0;
      } else if (optSortField === 'avgTimeToTarget') {
        valA = a.metrics.avgTimeToTargetVal;
        valB = b.metrics.avgTimeToTargetVal;
        if (valA === null || valA === undefined) valA = optSortAsc ? Infinity : -Infinity;
        if (valB === null || valB === undefined) valB = optSortAsc ? Infinity : -Infinity;
      }
      
      if (valA === null || valA === undefined) return optSortAsc ? -1 : 1;
      if (valB === null || valB === undefined) return optSortAsc ? 1 : -1;
      
      return optSortAsc ? valA - valB : valB - valA;
    });
    
    return sorted;
  }, [optimizationResults, optSortField, optSortAsc]);

  const renderSortIndicator = (field: string) => {
    if (optSortField !== field) return <span className="text-gray-600 ml-1 select-none font-normal">↕</span>;
    return <span className="text-amber-500 ml-1 select-none font-bold">{optSortAsc ? "▲" : "▼"}</span>;
  };

  // Trailing SL
  const [trailingSL, setTrailingSL] = useState<boolean>(false);
  const [trailingSLTrigger, setTrailingSLTrigger] = useState<string>("");
  const [trailingSLStep, setTrailingSLStep] = useState<string>("");

  // Check if start date is more than 60 days ago in Intraday mode
  const isIntradayDateRangeInvalid = useMemo(() => {
    if (backtestType !== 'INTRADAY' || !startDate) return false;
    const start = new Date(startDate);
    const limit = new Date();
    limit.setDate(limit.getDate() - 60);
    return start < limit;
  }, [backtestType, startDate]);


  // Legs State
  const [legs, setLegs] = useState<OptionLeg[]>([
    { id: "leg1", action: "SELL", optionType: "C", strikeOffset: 0, quantity: 1 },
    { id: "leg2", action: "SELL", optionType: "P", strikeOffset: 0, quantity: 1 }
  ]);

  // Typical spot prices for symbols if underlying is not matching or available
  const SYMBOL_SPOTS: Record<string, number> = {
    "NIFTY": 23000,
    "BANKNIFTY": 50000,
    "FINNIFTY": 22000,
    "MIDCPNIFTY": 12000,
    "RELIANCE": 2500,
    "SBIN": 800,
    "ITC": 430,
    "CRUDEOIL": 6500,
    "CRUDEOILM": 6500,
    "SILVER": 88000,
    "SILVERM": 88000,
    "GOLD": 72000,
    "GOLDM": 72000,
    "SPY": 500,
    "AAPL": 180,
    "TSLA": 180
  };

  const getLotSizeForSymbol = (sym: string): number => {
    const s = sym.toUpperCase();
    if (s === "NIFTY") return 65;
    if (s === "BANKNIFTY") return 30;
    if (s === "FINNIFTY") return 60;
    if (s === "MIDCPNIFTY") return 120;
    if (s === "RELIANCE") return 250;
    if (s === "HDFCBANK") return 550;
    if (s === "SBIN") return 750;
    if (s === "ITC") return 1600;
    if (s === "GOLD") return 100;
    if (s === "GOLDM") return 10;
    if (s === "SILVER") return 30;
    if (s === "SILVERM") return 5;
    if (s === "CRUDEOIL") return 100;
    if (s === "CRUDEOILM") return 10;
    if (s === "BTC" || s === "ETH") return 1;
    return 100;
  };

  const estimatedTriggers = useMemo(() => {
    try {
      const activeSpot = (underlying && underlying.symbol.toUpperCase() === backtestSymbol.toUpperCase()) 
        ? underlying.spot 
        : (SYMBOL_SPOTS[backtestSymbol.toUpperCase()] || 22000);

      const lotSize = getLotSizeForSymbol(backtestSymbol);

      // Convert backtest config legs to optionsMath StrategyLeg[] format
      const estimatedStrategyLegs: StrategyLeg[] = legs.map((leg, index) => {
        const strike = activeSpot + leg.strikeOffset;
        
        // Use a dummy 7 DTE expiry date
        const dummyExpiry = new Date();
        dummyExpiry.setDate(dummyExpiry.getDate() + 7);
        const expiryStr = dummyExpiry.toISOString().split('T')[0];

        // Theoretical BSM entry price
        const T = 7 / 365.0;
        const r = 0.065;
        const iv = 0.15;
        const entryPrice = leg.optionType === 'F'
          ? activeSpot
          : bsPricing(activeSpot, strike, T, r, iv, leg.optionType);

        return {
          id: leg.id || `leg-${index}`,
          strike,
          optionType: leg.optionType,
          expiry: expiryStr,
          action: leg.action,
          quantity: leg.quantity * lotSize,
          entryPrice,
          currentPrice: entryPrice,
          iv
        };
      });

      if (estimatedStrategyLegs.length === 0) {
        return { maxProfit: 0, maxLoss: 0, tpValRupees: 0, slValRupees: 0 };
      }

      const { metrics } = projectStrategy(estimatedStrategyLegs, activeSpot, 0, 0, 0.05, backtestSymbol);
      const maxProfitNum = typeof metrics.maxProfit === 'number' ? metrics.maxProfit : 0;
      const maxLossNum = typeof metrics.maxLoss === 'number' ? metrics.maxLoss : 0;

      const tpValRupees = Math.round(maxProfitNum * (takeProfitPct / 100));
      const slValRupees = stopLossType === 'pct_max_profit'
        ? Math.round(maxProfitNum * (stopLossPct / 100))
        : Math.round(-maxLossNum * (stopLossPct / 100));

      return {
        maxProfit: metrics.maxProfit,
        maxLoss: metrics.maxLoss,
        maxProfitVal: maxProfitNum,
        tpValRupees,
        slValRupees
      };
    } catch (e) {
      console.error("Error calculating estimated strategy limits", e);
      return { maxProfit: 0, maxLoss: 0, maxProfitVal: 0, tpValRupees: 0, slValRupees: 0 };
    }
  }, [legs, backtestSymbol, underlying, takeProfitPct, stopLossPct, stopLossType]);

  // Results State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [equityCurve, setEquityCurve] = useState<any[]>([]);
  const [monthlyGrid, setMonthlyGrid] = useState<any[]>([]);
  const [tradesLog, setTradesLog] = useState<any[]>([]);

  // Trades log sorting states
  const [tradeSortField, setTradeSortField] = useState<string>("entryDate");
  const [tradeSortAsc, setTradeSortAsc] = useState<boolean>(true);

  const handleTradeSort = (field: string) => {
    if (tradeSortField === field) {
      setTradeSortAsc(prev => !prev);
    } else {
      setTradeSortField(field);
      setTradeSortAsc(field === 'entryDate' || field === 'exitDate');
    }
  };

  const renderTradeSortIndicator = (field: string) => {
    if (tradeSortField !== field) return <span className="text-gray-600 ml-1 select-none font-normal">↕</span>;
    return <span className="text-cyan-400 ml-1 select-none font-bold">{tradeSortAsc ? "▲" : "▼"}</span>;
  };

  const sortedTradesLog = useMemo(() => {
    if (!tradesLog || tradesLog.length === 0) return [];
    const sorted = [...tradesLog];
    sorted.sort((a, b) => {
      let valA: any = a[tradeSortField];
      let valB: any = b[tradeSortField];

      if (tradeSortField === 'duration') {
        valA = parseDurationValue(a.duration);
        valB = parseDurationValue(b.duration);
      } else if (tradeSortField === 'entrySpot' || tradeSortField === 'exitSpot' || tradeSortField === 'netPnL') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        return tradeSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (valA === null || valA === undefined) return tradeSortAsc ? -1 : 1;
      if (valB === null || valB === undefined) return tradeSortAsc ? 1 : -1;
      return tradeSortAsc ? valA - valB : valB - valA;
    });
    return sorted;
  }, [tradesLog, tradeSortField, tradeSortAsc]);

  // Export Trades Log to CSV
  const handleExportTradesCSV = () => {
    if (!tradesLog || tradesLog.length === 0) {
      alert("No trade records to export.");
      return;
    }
    const cur = getCurrencySymbol(backtestSymbol);
    const headers = [
      "Trade #",
      "Entry Date/Time",
      "Entry Spot",
      "Exit Date/Time",
      "Exit Spot",
      "Duration",
      "Exit Reason",
      `Net PnL (${cur})`
    ];

    const rows = sortedTradesLog.map((tr, index) => [
      index + 1,
      `"${tr.entryDate || ''}"`,
      tr.entrySpot ?? '',
      `"${tr.exitDate || ''}"`,
      tr.exitSpot ?? '',
      `"${tr.duration || '-'}"`,
      `"${tr.exitReason || 'Market Close'}"`,
      tr.netPnL ?? 0
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${backtestSymbol}_Backtest_Trades_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Optimizer Ranked Permutations to CSV
  const handleExportOptimizerCSV = () => {
    if (!optimizationResults || optimizationResults.length === 0) {
      alert("No optimization results to export.");
      return;
    }
    const cur = getCurrencySymbol(backtestSymbol);
    const daysMap = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const headers = [
      "Rank",
      "OTM / Direction",
      "Stop Loss (%)",
      "Take Profit (%)",
      "Spread Width",
      "Days / Time",
      `Net Return (${cur})`,
      "Net Return (%)",
      "Win Rate (%)",
      "Max Drawdown (%)",
      "Profit Factor",
      "Avg Target Time"
    ];

    const rows = sortedOptimizationResults.map((row, index) => {
      const p = row.parameters;
      const m = row.metrics;
      const otmStr = p.directionOffset ? (p.directionOffset > 0 ? `+${p.directionOffset} C-OTM` : `${p.directionOffset} P-OTM`) : "ATM (0)";
      const daysStr = p.entryDays ? p.entryDays.map((d: number) => daysMap[d] || d).join(" ") : "";
      const timeStr = p.entryTime ? ` ${p.entryTime}` : "";

      return [
        index + 1,
        `"${otmStr}"`,
        p.stopLossPct !== null ? `${p.stopLossPct}%` : "None",
        p.takeProfitPct !== null ? `${p.takeProfitPct}%` : "None",
        p.strikeWidth !== null && p.strikeWidth !== undefined ? p.strikeWidth : "Original",
        `"${daysStr}${timeStr}"`,
        m.netPnL ?? 0,
        `${m.netReturnPct ?? 0}%`,
        `${m.winRate ?? 0}%`,
        `${m.maxDrawdown ?? 0}%`,
        m.profitFactor ?? '',
        `"${m.avgTimeToTarget || '-'}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${backtestSymbol}_Optimizer_Permutations_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseAndApplyPrompt = (promptText: string) => {
    setOptimizationPrompt(promptText);
    const p = promptText.toLowerCase();

    // 1. Objective Parsing
    if (p.includes("profit factor")) {
      setOptObjective("profitFactor");
    } else if (p.includes("drawdown") || p.includes("lowest drawdown") || p.includes("minimize drawdown")) {
      setOptObjective("maxDrawdown");
    } else if (p.includes("sharpe")) {
      setOptObjective("sharpeRatio");
    } else if (p.includes("win rate")) {
      setOptObjective("winRate");
    } else if (p.includes("net return") || p.includes("highest profit") || p.includes("net pnl")) {
      setOptObjective("netPnL");
    }

    // 2. Stop Loss Range Parsing e.g. "Stop Loss levels (20% to 60%)" or "20% to 50%"
    const slMatch = p.match(/(?:stop loss|sl)[^\d]*(\d+)%\s*to\s*(\d+)%/i) || p.match(/\((\d+)%\s*to\s*(\d+)%\)/i);
    if (slMatch) {
      const minSL = parseInt(slMatch[1]);
      const maxSL = parseInt(slMatch[2]);
      const range: number[] = [];
      for (let sl = 10; sl <= 100; sl += 10) {
        if (sl >= minSL && sl <= maxSL) range.push(sl);
      }
      if (range.length > 0) setOptStopLossRange(range);
    }

    // 3. Take Profit Range Parsing e.g. "take profit (20% to 80%)"
    const tpMatch = p.match(/(?:take profit|tp)[^\d]*(\d+)%\s*to\s*(\d+)%/i);
    if (tpMatch) {
      const minTP = parseInt(tpMatch[1]);
      const maxTP = parseInt(tpMatch[2]);
      const range: number[] = [];
      for (let tp = 10; tp <= 100; tp += 10) {
        if (tp >= minTP && tp <= maxTP) range.push(tp);
      }
      if (range.length > 0) setOptTakeProfitRange(range);
    }
  };

  const handleApplyPreset = (key: string) => {
    if (key === "rsi_scanner") {
      setStrategyType("RSI_SCANNER");
      setBacktestType("INTRADAY");
      setLegs([]);
      setOptimizerActivePreset("rsi_scanner");
      const pr = OPTIMIZATION_PROMPTS["rsi_scanner"] || "";
      parseAndApplyPrompt(pr);
      return;
    }
    setStrategyType("STANDARD");
    const preset = STRATEGY_PRESETS[key];
    if (preset) {
      const newLegs = preset.legs.map((l, index) => ({
        ...l,
        id: `leg-${index}-${Math.random()}`
      }));
      setLegs(newLegs);
      setOptimizerActivePreset(key);
      const pr = OPTIMIZATION_PROMPTS[key] || "";
      parseAndApplyPrompt(pr);
    }
  };

  // Add a leg custom builder
  const handleAddLeg = () => {
    const newLeg: OptionLeg = {
      id: `leg-${Math.random()}`,
      action: "BUY",
      optionType: "C",
      strikeOffset: 0,
      quantity: 1
    };
    setLegs(prev => [...prev, newLeg]);
    setOptimizerActivePreset("");
  };

  // Remove a leg
  const handleRemoveLeg = (id: string) => {
    setLegs(prev => prev.filter(l => l.id !== id));
    setOptimizerActivePreset("");
  };

  // Update a specific leg detail
  const handleUpdateLeg = (id: string, updates: Partial<OptionLeg>) => {
    setLegs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    setOptimizerActivePreset("");
  };

  // Toggle Entry Day selection
  const handleToggleEntryDay = (day: number) => {
    setEntryDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day].sort()
    );
  };

  // Run backtest request
  const handleRunBacktest = async () => {
    if (strategyType !== 'RSI_SCANNER' && legs.length === 0) {
      alert("Please add at least one strategy leg to backtest.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload: any = {
        symbol: backtestSymbol,
        startDate,
        endDate,
        strategyType,
        slippagePerLeg: slippage,
        initialCapital,
        backtestType: strategyType === 'RSI_SCANNER' ? 'INTRADAY' : backtestType,
        intradayInterval,
        expiryType,
        legs: legs.map(({ action, optionType, strikeOffset, quantity }) => ({
          action,
          optionType,
          strikeOffset,
          quantity
        }))
      };

      if (strategyType === 'RSI_SCANNER') {
        payload.rsiPeriod = rsiPeriod;
        payload.rsiUpper = rsiUpper;
        payload.rsiLower = rsiLower;
        payload.moneyness = rsiMoneyness;
        payload.lots = rsiLots;
        payload.takeProfitPct = rsiTpPct > 0 ? rsiTpPct : null;
        payload.stopLossPct = rsiSlPct > 0 ? rsiSlPct : null;
      } else {
        payload.entryDaysOfWeek = entryDays;
        payload.entryTime = entryTime;
        payload.exitTime = exitTime;
        payload.legStopLossPct = legStopLossPct !== "" ? parseFloat(legStopLossPct) : null;
        payload.legTakeProfitPct = legTakeProfitPct !== "" ? parseFloat(legTakeProfitPct) : null;
        payload.portfolioStopLoss = portfolioStopLoss !== "" ? parseFloat(portfolioStopLoss) : null;
        payload.portfolioTakeProfit = portfolioTakeProfit !== "" ? parseFloat(portfolioTakeProfit) : null;
        payload.takeProfitPct = takeProfitPct > 0 ? takeProfitPct : null;
        payload.stopLossPct = stopLossPct > 0 ? stopLossPct : null;
        payload.stopLossType = stopLossType;
        payload.trailingSL = trailingSL;
        payload.trailingSLTrigger = trailingSLTrigger !== "" ? parseFloat(trailingSLTrigger) : null;
        payload.trailingSLStep = trailingSLStep !== "" ? parseFloat(trailingSLStep) : null;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(`${BACKEND_URL}/api/backtest/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (response.ok) {
        setMetrics(data.metrics);
        setEquityCurve(data.equityCurve);
        setMonthlyGrid(data.monthlyGrid);
        setTradesLog(data.trades);
      } else {
        throw new Error(formatErrorDetail(data.detail, "Backtest computation failed."));
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === 'AbortError') {
        setError("Backtest request timed out after 60s. The server is downloading historical candles or waking up. Please try clicking Run again.");
      } else {
        setError(err.message || "Connection failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Run strategy parameter optimization
  const handleRunOptimization = async () => {
    if (strategyType !== 'RSI_SCANNER' && legs.length === 0) {
      alert("Please add at least one strategy leg to optimize.");
      return;
    }
    setIsOptimizing(true);
    setError(null);
    try {
      let payload: any;
      if (strategyType === 'RSI_SCANNER') {
        payload = {
          symbol: backtestSymbol,
          startDate,
          endDate,
          strategyType: 'RSI_SCANNER',
          rsiPeriodRange: optRsiPeriodRange,
          rsiUpperRange: optRsiLevelsRange.map(l => parseFloat(l.split('/')[0])),
          rsiLowerRange: optRsiLevelsRange.map(l => parseFloat(l.split('/')[1])),
          takeProfitPctRange: optTakeProfitRange,
          stopLossPctRange: optStopLossRange,
          moneynessRange: optRsiMoneynessRange,
          lots: rsiLots,
          slippagePerLeg: slippage,
          initialCapital,
          objective: optObjective,
          legs: []
        };
      } else {
        const entryDaysRange = optEntryDaysRange.map(day => [day]);
        payload = {
          symbol: backtestSymbol,
          startDate,
          endDate,
          prompt: optimizationPrompt,
          legs: legs.map(({ action, optionType, strikeOffset, quantity }) => ({
            action,
            optionType,
            strikeOffset,
            quantity
          })),
          initialCapital,
          backtestType,
          slippagePerLeg: slippage,
          takeProfitPctRange: optTakeProfitRange.length > 0 ? [...optTakeProfitRange, null] : [null],
          stopLossPctRange: optStopLossRange.length > 0 ? [...optStopLossRange, null] : [null],
          entryTimeRange: backtestType === 'INTRADAY' ? optEntryTimeRange : null,
          entryDaysRange: entryDaysRange.length > 0 ? entryDaysRange : null,
          strikeWidthRange: optStrikeWidthRange.length > 0 ? optStrikeWidthRange : null,
          directionOffsetRange: optDirectionOffsetRange.length > 0 ? optDirectionOffsetRange : [0],
          objective: optObjective,
          expiryType
        };
      }

      const optController = new AbortController();
      const optTimeoutId = setTimeout(() => optController.abort(), 120000); // 120s timeout

      const response = await fetch(`${BACKEND_URL}/api/backtest/optimize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
        signal: optController.signal
      });
      clearTimeout(optTimeoutId);

      const data = await response.json();
      if (response.ok) {
        setOptimizationResults(data.results);
        setOptSortField("rank");
        setOptSortAsc(true);
      } else {
        throw new Error(formatErrorDetail(data.detail, "Optimization run failed."));
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === 'AbortError') {
        setError("Optimization sweep timed out after 120s. Try sweeping fewer parameters or a smaller date range.");
      } else {
        setError(err.message || "Optimization connection failed.");
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplyOptimalConfig = (result: any) => {
    const p = result.parameters;
    if (strategyType === 'RSI_SCANNER') {
      if (p.rsiPeriod) setRsiPeriod(p.rsiPeriod);
      if (p.rsiUpper) setRsiUpper(p.rsiUpper);
      if (p.rsiLower) setRsiLower(p.rsiLower);
      if (p.moneyness) setRsiMoneyness(p.moneyness);
      if (p.takeProfitPct !== undefined && p.takeProfitPct !== null) setRsiTpPct(p.takeProfitPct);
      if (p.stopLossPct !== undefined && p.stopLossPct !== null) setRsiSlPct(p.stopLossPct);
      setResultsSubTab('backtest');
      alert(`Applied optimal RSI parameters:\nRSI Period: ${p.rsiPeriod}\nLevels: ${p.rsiLower}/${p.rsiUpper}\nMoneyness: ${p.moneyness}\nTarget: +${p.takeProfitPct}%\nStop Loss: -${p.stopLossPct}%`);
      return;
    }

    if (p.takeProfitPct !== null) {
      setTakeProfitPct(p.takeProfitPct);
    } else {
      setTakeProfitPct(0);
    }
    
    if (p.stopLossPct !== null) {
      setStopLossPct(p.stopLossPct);
    } else {
      setStopLossPct(0);
    }
    
    if (p.entryTime !== null) {
      setEntryTime(p.entryTime);
    }
    
    if (p.exitTime !== null) {
      setExitTime(p.exitTime);
    }
    
    if (p.entryDays !== null) {
      setEntryDays(p.entryDays);
    }
    
    // Scale legs if strikeWidth is returned and not null
    let updatedLegs = [...legs];
    if (p.strikeWidth !== null && p.strikeWidth !== undefined && legs.length > 0) {
      const nonZeroOffsets = legs.map(l => Math.abs(l.strikeOffset)).filter(o => o !== 0);
      if (nonZeroOffsets.length > 0) {
        const baseSpacing = Math.min(...nonZeroOffsets);
        if (baseSpacing > 0) {
          const factor = p.strikeWidth / baseSpacing;
          updatedLegs = updatedLegs.map(l => ({
            ...l,
            strikeOffset: Math.round(l.strikeOffset * factor)
          }));
        }
      }
    }

    // Shift legs if directionOffset is returned and non-zero
    if (p.directionOffset !== undefined && p.directionOffset !== 0 && legs.length > 0) {
      updatedLegs = updatedLegs.map(l => ({
        ...l,
        strikeOffset: l.strikeOffset + p.directionOffset
      }));
    }

    if (legs.length > 0) {
      setLegs(updatedLegs);
    }
    
    setResultsSubTab('backtest');
    alert("Optimal configuration applied! Running backtest with new parameters...");
    // Trigger backtest run automatically
    setTimeout(() => {
      handleRunBacktest();
    }, 100);
  };

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const cur = getCurrencySymbol(backtestSymbol);
      return (
        <div className="bg-gray-950/90 border border-borderClr p-2.5 rounded-lg text-xs flex flex-col gap-1 shadow-lg">
          <span className="text-white font-extrabold">{data.date}</span>
          <span className="text-accentCyan">Capital: {cur}{data.equity.toLocaleString()}</span>
          <span className="text-gray-400">Spot price: {cur}{data.spot.toLocaleString()}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* LEFT COLUMN: Configurations & Builder */}
      <div className="xl:col-span-1 flex flex-col gap-6">
        {/* Backtester controls */}
        <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-4 bg-gray-950/40">
          <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-borderClr/20 pb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-400" />
            Backtest Configurations
          </span>

          <div className="flex flex-col gap-3.5 text-xs text-left">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Underlying Asset</span>
                <select
                  value={backtestSymbol}
                  onChange={(e) => setBacktestSymbol(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-400"
                >
                  {SYMBOL_OPTIONS.map((sym) => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Backtest Mode</span>
                <div className="flex bg-gray-900 p-0.5 rounded border border-borderClr/40 h-[30px] items-center">
                  <button
                    type="button"
                    onClick={() => setBacktestType('EOD')}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                      backtestType === 'EOD' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    EOD
                  </button>
                  <button
                    type="button"
                    onClick={() => setBacktestType('INTRADAY')}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                      backtestType === 'INTRADAY' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Intraday
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Option Expiry Cycle</span>
              <select
                value={expiryType}
                onChange={(e) => setExpiryType(e.target.value)}
                className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-400"
              >
                {(() => {
                  const sym = backtestSymbol.toUpperCase();
                  const isCrypto = ["BTC", "ETH", "SOL"].includes(sym);
                  const isUS = ["SPY", "AAPL", "TSLA"].includes(sym);
                  const isIndianStock = ["RELIANCE", "SBIN", "ITC"].includes(sym);
                  
                  if (isCrypto) {
                    return (
                      <>
                        <option value="daily">Daily Expiry (+1 Day)</option>
                        <option value="+2 day">+2 Day Expiry</option>
                        <option value="+3 day">+3 Day Expiry</option>
                        <option value="+4 day">+4 Day Expiry</option>
                        <option value="+5 day">+5 Day Expiry</option>
                        <option value="+6 day">+6 Day Expiry</option>
                        <option value="weekly">Weekly Expiry (Friday)</option>
                        <option value="monthly">Monthly Expiry (Last Friday)</option>
                      </>
                    );
                  } else if (isUS) {
                    return (
                      <>
                        <option value="weekly">Weekly Expiry (Friday)</option>
                        <option value="monthly">Monthly Expiry (Last Friday)</option>
                      </>
                    );
                  } else if (isIndianStock) {
                    return (
                      <>
                        <option value="monthly">Monthly Expiry (Last Thursday)</option>
                      </>
                    );
                  } else {
                    // Indian index weekly options (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY)
                    const dayName = sym === "NIFTY" ? "Tuesday" : sym === "BANKNIFTY" ? "Wednesday" : "Thursday";
                    return (
                      <>
                        <option value="weekly">Weekly Expiry ({dayName})</option>
                        <option value="monthly">Monthly Expiry (Last {dayName})</option>
                      </>
                    );
                  }
                })()}
              </select>
            </div>

            {isIntradayDateRangeInvalid && (
              <div className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 rounded p-2.5 flex items-center gap-1.5 leading-relaxed">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Intraday backtests longer than 60 days will fetch data from Delta Exchange. EOD mode is recommended for faster runs.</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Initial Capital</span>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(parseInt(e.target.value) || 0)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Slippage Per Leg</span>
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseInt(e.target.value) || 0)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Entry Days Selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Entry Days of Week</span>
              <div className="flex gap-1.5 mt-1">
                {[
                  { label: "Mon", val: 0 },
                  { label: "Tue", val: 1 },
                  { label: "Wed", val: 2 },
                  { label: "Thu", val: 3 },
                  { label: "Fri", val: 4 }
                ].map((d) => {
                  const isSelected = entryDays.includes(d.val);
                  return (
                    <button
                      key={d.val}
                      onClick={() => handleToggleEntryDay(d.val)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all ${
                        isSelected 
                          ? "bg-amber-500/15 border-amber-500 text-amber-400" 
                          : "bg-gray-950 border-borderClr/30 text-gray-500 hover:text-white"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Take Profit & Stop Loss Sliders */}
            <div className="flex flex-col gap-3 mt-1.5 pt-3 border-t border-borderClr/20">
              <div className="flex flex-col gap-1.5 text-[10px]">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-gray-400 uppercase tracking-wider">Take Profit: <strong className="text-greenBrand">{takeProfitPct}%</strong></span>
                  <span className="text-gray-400 font-semibold">Trigger at: <strong className="text-white">
                    {(() => {
                      const cur = getCurrencySymbol(backtestSymbol);
                      return estimatedTriggers.maxProfit === 'Unlimited' ? 'Unlimited' : `${cur}${estimatedTriggers.tpValRupees.toLocaleString()}`;
                    })()}
                  </strong></span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={takeProfitPct}
                  onChange={(e) => setTakeProfitPct(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-greenBrand cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1.5 text-[10px]">
                <div className="flex justify-between items-center font-bold gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400 uppercase tracking-wider">Stop Loss: <strong className="text-redBrand">{stopLossPct}%</strong></span>
                    <div className="flex bg-gray-900 rounded p-0.5 border border-borderClr/40 text-[9px]">
                      <button
                        type="button"
                        onClick={() => setStopLossType('pct_max_loss')}
                        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                          stopLossType === 'pct_max_loss' ? 'bg-redBrand text-white' : 'text-gray-400 hover:text-white'
                        }`}
                        title="Stop loss as a percentage of Max Loss / Capital"
                      >
                        % Max Loss
                      </button>
                      <button
                        type="button"
                        onClick={() => setStopLossType('pct_max_profit')}
                        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                          stopLossType === 'pct_max_profit' ? 'bg-redBrand text-white' : 'text-gray-400 hover:text-white'
                        }`}
                        title="Stop loss as a percentage of Max Profit"
                      >
                        % Max Profit
                      </button>
                    </div>
                  </div>
                  <span className="text-gray-400 font-semibold">Trigger at: <strong className="text-white">
                    {(() => {
                      const cur = getCurrencySymbol(backtestSymbol);
                      if (stopLossType === 'pct_max_profit') {
                        return estimatedTriggers.maxProfit === 'Unlimited' 
                          ? 'N/A' 
                          : `-${cur}${estimatedTriggers.slValRupees.toLocaleString()}`;
                      }
                      return estimatedTriggers.maxLoss === 'Unlimited' ? 'Unlimited' : `${cur}${estimatedTriggers.slValRupees.toLocaleString()}`;
                    })()}
                  </strong></span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={stopLossPct}
                  onChange={(e) => setStopLossPct(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-redBrand cursor-pointer"
                />
              </div>
            </div>

            {backtestType === 'INTRADAY' && (
              <>
                <div className="border-t border-borderClr/20 my-1 pt-2.5">
                  <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest block mb-2">Intraday Timing</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Timeframe</span>
                      <select
                        value={intradayInterval}
                        onChange={(e) => setIntradayInterval(parseInt(e.target.value))}
                        className="bg-gray-900 border border-borderClr rounded px-1 py-1.5 text-white text-[10px] outline-none"
                      >
                        <option value={1}>1 min</option>
                        <option value={5}>5 min</option>
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Entry Time</span>
                      <input
                        type="text"
                        value={entryTime}
                        onChange={(e) => setEntryTime(e.target.value)}
                        placeholder="09:20"
                        className="bg-gray-900 border border-borderClr rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400 text-center"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Exit Time</span>
                      <input
                        type="text"
                        value={exitTime}
                        onChange={(e) => setExitTime(e.target.value)}
                        placeholder="15:15"
                        className="bg-gray-900 border border-borderClr rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400 text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-borderClr/20 my-1 pt-2.5 flex flex-col gap-2.5">
                  <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest block">Intraday Rules</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Leg Stop Loss (%)</span>
                      <input
                        type="number"
                        placeholder="None"
                        value={legStopLossPct}
                        onChange={(e) => setLegStopLossPct(e.target.value)}
                        className="bg-gray-900 border border-borderClr rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Leg Target (%)</span>
                      <input
                        type="number"
                        placeholder="None"
                        value={legTakeProfitPct}
                        onChange={(e) => setLegTakeProfitPct(e.target.value)}
                        className="bg-gray-900 border border-borderClr rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-borderClr/20 my-1 pt-2.5 flex flex-col gap-2.5">
              <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest block">Portfolio Protection</span>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Max Loss Restriction / Portfolio SL (₹)</span>
                    <span className="text-[8px] text-amber-400 font-mono">Hard exit if loss hits ₹ limit</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {[
                      { label: "No SL", val: "" },
                      { label: "₹5,000", val: "5000" },
                      { label: "₹10,000", val: "10000" },
                      { label: "₹15,000", val: "15000" },
                      { label: "₹20,000", val: "20000" },
                      { label: "₹25,000", val: "25000" }
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setPortfolioStopLoss(opt.val)}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-bold border transition-all ${
                          portfolioStopLoss === opt.val
                            ? "bg-red-600 text-white border-red-500 shadow-sm"
                            : "bg-gray-900 border-borderClr/40 text-gray-400 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={portfolioStopLoss}
                    onChange={(e) => setPortfolioStopLoss(e.target.value)}
                    className="bg-gray-900 border border-borderClr rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-gray-500 font-bold uppercase">Portfolio Target / TP (₹)</span>
                  <input
                    type="number"
                    placeholder="e.g. 25000 (Optional)"
                    value={portfolioTakeProfit}
                    onChange={(e) => setPortfolioTakeProfit(e.target.value)}
                    className="bg-gray-900 border border-borderClr rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-1 border border-borderClr/20 p-2 rounded bg-gray-950/20">
                <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={trailingSL}
                    onChange={(e) => setTrailingSL(e.target.checked)}
                    className="rounded bg-gray-900 border-borderClr text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wide">Enable Trailing SL</span>
                </label>

                {trailingSL && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-500 font-bold uppercase text-left">Trigger Profit</span>
                      <input
                        type="number"
                        placeholder="2000"
                        value={trailingSLTrigger}
                        onChange={(e) => setTrailingSLTrigger(e.target.value)}
                        className="bg-gray-900 border border-borderClr rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-500 font-bold uppercase text-left">Trail Step</span>
                      <input
                        type="number"
                        placeholder="500"
                        value={trailingSLStep}
                        onChange={(e) => setTrailingSLStep(e.target.value)}
                        className="bg-gray-900 border border-borderClr rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Presets */}
        <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-3 bg-gray-950/40">
          <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-borderClr/20 pb-2">
            Apply Strategy Preset
          </span>
          <div className="flex flex-col gap-1.5">
            <select
              value={optimizerActivePreset}
              onChange={(e) => {
                if (e.target.value) {
                  handleApplyPreset(e.target.value);
                }
              }}
              className="w-full bg-gray-900 border border-borderClr rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-400 cursor-pointer transition-all font-semibold"
            >
              <option value="" disabled>-- Custom Strategy / Select Preset --</option>
              {Object.keys(STRATEGY_PRESETS).map((key) => (
                <option key={key} value={key} className="bg-gray-950 text-white font-semibold">
                  {STRATEGY_PRESETS[key].name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Strategy Leg Builder / RSI Configuration */}
        {strategyType === 'RSI_SCANNER' ? (
          <div className="glass-panel rounded-xl p-5 border border-emerald-500/30 flex flex-col gap-4 bg-emerald-950/10 text-left">
            <div className="flex items-center justify-between border-b border-borderClr/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  ⚡ RSI Momentum Scalper Settings
                </span>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
                Intraday Breakout
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">RSI Period</span>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={rsiPeriod}
                  onChange={(e) => setRsiPeriod(parseInt(e.target.value) || 3)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs font-bold focus:border-emerald-400 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Bullish Over</span>
                <input
                  type="number"
                  min="50"
                  max="95"
                  value={rsiUpper}
                  onChange={(e) => setRsiUpper(parseFloat(e.target.value) || 80)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-emerald-400 text-xs font-bold focus:border-emerald-400 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Bearish Under</span>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={rsiLower}
                  onChange={(e) => setRsiLower(parseFloat(e.target.value) || 20)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-red-400 text-xs font-bold focus:border-emerald-400 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Option Strike</span>
                <select
                  value={rsiMoneyness}
                  onChange={(e) => setRsiMoneyness(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs font-bold focus:border-emerald-400 outline-none"
                >
                  <option value="ATM">ATM (At The Money)</option>
                  <option value="OTM1">OTM +1 Strike</option>
                  <option value="OTM2">OTM +2 Strikes</option>
                  <option value="ITM">ITM -1 Strike</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Lots</span>
                <input
                  type="number"
                  min="1"
                  value={rsiLots}
                  onChange={(e) => setRsiLots(parseInt(e.target.value) || 1)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs font-bold focus:border-emerald-400 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Take Profit (TP %)</span>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={rsiTpPct}
                  onChange={(e) => setRsiTpPct(parseFloat(e.target.value) || 30)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-emerald-400 text-xs font-bold focus:border-emerald-400 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Stop Loss (SL %)</span>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={rsiSlPct}
                  onChange={(e) => setRsiSlPct(parseFloat(e.target.value) || 15)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-red-400 text-xs font-bold focus:border-emerald-400 outline-none"
                />
              </div>
            </div>

            <div className="text-[10px] text-gray-400 bg-gray-950/40 p-2.5 rounded-lg border border-borderClr/20 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span>🟢</span>
                <span>RSI &gt;= {rsiUpper}: Buys Call on candle breakout.</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-400 font-medium">
                <span>🔴</span>
                <span>RSI &lt;= {rsiLower}: Buys Put on candle breakdown.</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                <span>⏱️</span>
                <span>Exits at <strong>+{rsiTpPct}% TP</strong>, <strong>-{rsiSlPct}% SL</strong>, or 15:20 IST EOD.</span>
              </div>
            </div>

            <button
              onClick={handleRunBacktest}
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-600 text-black font-extrabold rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <Activity className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-black text-black stroke-[3px]" />
              )}
              {isLoading ? "Backtesting RSI Strategy..." : "Run RSI Strategy Backtest"}
            </button>
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-4 bg-gray-950/40">
            <div className="flex items-center justify-between border-b border-borderClr/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Strategy Legs ({legs.length})
                </span>
                {portfolioStopLoss ? (
                  <span className="text-[10px] bg-red-950/60 border border-red-500/40 text-red-400 px-1.5 py-0.5 rounded font-mono font-bold">
                    🛡️ Max Loss Cap: ₹{parseFloat(portfolioStopLoss).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-950/40 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded font-mono">
                    ⚠️ No SL (Hold to Expiry)
                  </span>
                )}
              </div>
              <button
                onClick={handleAddLeg}
                className="px-2 py-1 rounded bg-gray-900 border border-borderClr/60 hover:text-white text-xs font-bold flex items-center gap-1 transition-all"
              >
                <Plus className="w-3 h-3" />
                Add Leg
              </button>
            </div>

            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
              {legs.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500 border border-dashed border-borderClr/20 rounded-xl bg-gray-950/10">
                  No active legs. Apply a preset or add a leg above.
                </div>
              ) : (
                legs.map((leg) => (
                  <div key={leg.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-950/60 border border-borderClr/40 text-xs">
                    <select
                      value={leg.action}
                      onChange={(e) => handleUpdateLeg(leg.id, { action: e.target.value as any })}
                      className={`bg-gray-900 border rounded px-1 py-1 font-bold ${
                        leg.action === "BUY" ? "text-greenBrand border-greenBrand/40" : "text-redBrand border-redBrand/40"
                      }`}
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>

                    <select
                      value={leg.optionType}
                      onChange={(e) => handleUpdateLeg(leg.id, { optionType: e.target.value as any })}
                      className="bg-gray-900 border border-borderClr/60 rounded px-1.5 py-1 text-white"
                    >
                      <option value="C">CE</option>
                      <option value="P">PE</option>
                      <option value="F">FUT</option>
                    </select>

                    <div className="flex flex-col gap-0.5 flex-1">
                      <span className="text-[9px] text-gray-500 uppercase font-bold text-left">Offset</span>
                      <select
                        value={leg.optionType === 'F' ? 0 : leg.strikeOffset}
                        disabled={leg.optionType === 'F'}
                        onChange={(e) => handleUpdateLeg(leg.id, { strikeOffset: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-gray-900 border border-borderClr/60 rounded px-1 py-1.5 text-white text-xs outline-none focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {leg.optionType === 'F' ? (
                          <option value="0">0 (N/A)</option>
                        ) : (
                          getOffsetOptionsForSymbol(backtestSymbol, leg.strikeOffset).map((val) => (
                            <option key={val} value={val}>
                              {val === 0 ? "0 (ATM)" : val > 0 ? `+${val}` : `${val}`}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="flex flex-col gap-0.5 w-12">
                      <span className="text-[9px] text-gray-500 uppercase font-bold text-left">Qty</span>
                      <input
                        type="number"
                        value={leg.quantity}
                        onChange={(e) => handleUpdateLeg(leg.id, { quantity: parseInt(e.target.value) || 1 })}
                        className="w-full bg-gray-900 border border-borderClr/60 rounded px-1.5 py-1 text-white"
                      />
                    </div>

                    <button
                      onClick={() => handleRemoveLeg(leg.id)}
                      className="p-1.5 text-gray-500 hover:text-redBrand hover:bg-gray-900 rounded transition-all self-end"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={handleRunBacktest}
              disabled={isLoading}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/20 disabled:text-gray-600 text-black font-extrabold rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <Activity className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-black text-black stroke-[3px]" />
              )}
              {isLoading ? "Running Backtest..." : backtestType === 'EOD' ? "Run EOD Backtest" : "Run Intraday Backtest"}
            </button>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Results, Graphs & Tables */}
      <div className="xl:col-span-2 flex flex-col gap-6">
        {/* Tab Selection header */}
        <div className="flex gap-2 border-b border-borderClr/20 pb-3 px-1">
          <button
            onClick={() => setResultsSubTab('backtest')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              resultsSubTab === 'backtest'
                ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/10"
                : "bg-gray-950 border-borderClr/60 text-gray-400 hover:text-white"
            }`}
          >
            Backtest Metrics & Logs
          </button>
          <button
            onClick={() => setResultsSubTab('optimizer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              resultsSubTab === 'optimizer'
                ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/10"
                : "bg-gray-950 border-borderClr/60 text-gray-400 hover:text-white"
            }`}
          >
            AI Strategy Parameter Optimizer
          </button>
        </div>

        {error && (
          <div className="bg-redBrand/10 border border-redBrand/30 text-redBrand rounded-xl p-3 flex items-center gap-2 text-xs text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-redBrand" />
            <span><strong>Backtest Error:</strong> {error}</span>
          </div>
        )}

        {resultsSubTab === 'backtest' && (
          <>
            {!metrics && !isLoading && (
          <div className="glass-panel rounded-xl p-12 border border-borderClr/30 flex flex-col items-center justify-center text-gray-500 text-xs min-h-[550px] bg-gray-950/40">
            <TrendingUp className="w-12 h-12 text-gray-700 mb-3 animate-pulse" />
            <span>Configure your options strategy parameters on the left and click **Run {backtestType} Backtest** to analyze performance.</span>
          </div>
        )}

        {isLoading && (
          <div className="glass-panel rounded-xl p-12 border border-borderClr/30 flex flex-col items-center justify-center text-gray-500 text-xs min-h-[550px] bg-gray-950/40 gap-3">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span className="font-bold text-white uppercase tracking-widest text-[10px]">Processing Historical Data...</span>
            <span className="text-[10px] text-gray-400">Fetching 5m candles and simulating options price action...</span>
            <button
              onClick={() => setIsLoading(false)}
              className="mt-1 text-[10px] text-gray-400 hover:text-red-400 underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {metrics && !isLoading && (
          <>
            {/* Header with Save as Scanner Rule button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-950/30 p-4 rounded-xl border border-borderClr/15 text-left mb-4 gap-3">
              <div className="flex flex-col">
                <span className="text-[9px] text-accentCyan font-extrabold uppercase tracking-widest">Backtest Performance Report</span>
                <span className="text-xs font-bold text-white mt-0.5">Asset: {backtestSymbol} • Spanning {startDate} to {endDate}</span>
              </div>
              <button
                onClick={handleSaveAsScannerRule}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                Save as Active Scanner Rule
              </button>
            </div>

            {/* Scorecard stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-left border-t border-borderClr/10 pt-4">
              <div className="bg-gray-950/40 p-3 rounded-lg border border-borderClr/20 flex flex-col justify-between h-16">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Net Profit/Loss</span>
                <span className={`text-sm font-extrabold mt-0.5 ${metrics.netPnL >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                  {(() => {
                    const cur = getCurrencySymbol(backtestSymbol);
                    return `${cur}${metrics.netPnL.toLocaleString()} (${metrics.netReturnPct}%)`;
                  })()}
                </span>
              </div>
              <div className="bg-gray-950/40 p-3 rounded-lg border border-borderClr/20 flex flex-col justify-between h-16">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Win Rate (Trades)</span>
                <span className="text-sm font-extrabold text-greenBrand mt-0.5">{metrics.winRate}% <span className="text-xs text-gray-400 font-normal">({metrics.totalTrades})</span></span>
              </div>
              <div className="bg-gray-950/40 p-3 rounded-lg border border-borderClr/20 flex flex-col justify-between h-16">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Max Drawdown</span>
                <span className="text-sm font-extrabold text-redBrand mt-0.5">{metrics.maxDrawdown}%</span>
              </div>
              <div className="bg-gray-950/40 p-3 rounded-lg border border-borderClr/20 flex flex-col justify-between h-16">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Sharpe / Profit Factor</span>
                <span className="text-sm font-extrabold text-white mt-0.5">
                  {metrics.sharpeRatio} / {metrics.profitFactor}
                </span>
              </div>
              <div className="bg-gray-950/40 p-3 rounded-lg border border-borderClr/20 flex flex-col justify-between h-16">
                <span className="text-[9px] text-cyan-400 font-bold uppercase">Avg Time to Target</span>
                <span className="text-sm font-extrabold text-cyan-300 mt-0.5 flex items-center gap-1">
                  {metrics.avgTimeToTarget || "-"} 
                  {metrics.targetHitRate !== undefined && metrics.targetHitRate > 0 && (
                    <span className="text-[10px] text-gray-400 font-normal">({metrics.targetHitRate}% hits)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Equity Curve chart */}
            <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-3 bg-gray-950/40 text-left">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Equity Curve</span>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurve} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eqProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#4b5563" fontSize={9} />
                    <YAxis stroke="#4b5563" fontSize={9} domain={['dataMin - 1000', 'dataMax + 1000']} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="equity" stroke="#00f0ff" strokeWidth={1.5} fill="url(#eqProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stockmock style Month-wise P&L table */}
            <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-3 bg-gray-950/40 text-left overflow-x-auto">
              {(() => {
                const cur = getCurrencySymbol(backtestSymbol);
                return (
                  <>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Monthly P&L Grid ({cur})</span>
                    <table className="w-full text-left text-[11px] border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-borderClr/20 text-gray-500">
                          <th className="py-2 font-bold">Year</th>
                          {monthLabels.map((lbl) => (
                            <th key={lbl} className="py-2 px-1 font-bold text-right">{lbl}</th>
                          ))}
                          <th className="py-2 font-bold text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyGrid.map((row) => (
                          <tr key={row.year} className="border-b border-borderClr/10 text-gray-300">
                            <td className="py-2 font-bold text-white">{row.year}</td>
                            {Array.from({ length: 12 }).map((_, idx) => {
                              const val = row[`m${idx + 1}`];
                              return (
                                <td 
                                  key={idx} 
                                  className={`py-2 px-1 text-right font-semibold ${
                                    val > 0 ? "text-greenBrand" : val < 0 ? "text-redBrand" : "text-gray-500"
                                  }`}
                                >
                                  {val !== 0 ? val.toLocaleString() : "0"}
                                </td>
                              );
                            })}
                            <td 
                              className={`py-2 font-bold text-right ${
                                row.total > 0 ? "text-greenBrand" : row.total < 0 ? "text-redBrand" : "text-gray-500"
                              }`}
                            >
                              {cur}{row.total.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                );
              })()}
            </div>

            {/* Trades logs */}
            <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-3 bg-gray-950/40 text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-borderClr/20 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Trades Log (Total: {metrics.totalTrades})
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    (Click headers to sort)
                  </span>
                </div>
                <button
                  onClick={handleExportTradesCSV}
                  className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500 hover:text-black border border-cyan-500/30 text-cyan-400 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                  title="Download Trades Log as CSV Spreadsheet"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Trades CSV
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto pr-1">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-borderClr/20 text-gray-500 text-left select-none">
                      <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleTradeSort('entryDate')}>
                        Entry Date/Time {renderTradeSortIndicator('entryDate')}
                      </th>
                      <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleTradeSort('entrySpot')}>
                        Entry Spot {renderTradeSortIndicator('entrySpot')}
                      </th>
                      <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleTradeSort('exitDate')}>
                        Exit Date/Time {renderTradeSortIndicator('exitDate')}
                      </th>
                      <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleTradeSort('exitSpot')}>
                        Exit Spot {renderTradeSortIndicator('exitSpot')}
                      </th>
                      <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleTradeSort('duration')}>
                        Duration {renderTradeSortIndicator('duration')}
                      </th>
                      <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleTradeSort('exitReason')}>
                        Exit Reason {renderTradeSortIndicator('exitReason')}
                      </th>
                      <th className="py-2 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleTradeSort('netPnL')}>
                        Net P&L {renderTradeSortIndicator('netPnL')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTradesLog.map((tr, index) => {
                      const cur = getCurrencySymbol(backtestSymbol);
                      return (
                        <tr key={index} className="border-b border-borderClr/10 text-gray-300 hover:bg-gray-900/40">
                          <td className="py-2 font-mono text-[10.5px]">{tr.entryDate}</td>
                          <td className="py-2 font-mono">{cur}{tr.entrySpot.toLocaleString()}</td>
                          <td className="py-2 font-mono text-[10.5px]">{tr.exitDate}</td>
                          <td className="py-2 font-mono">{cur}{tr.exitSpot.toLocaleString()}</td>
                          <td className="py-2 text-cyan-400 font-mono font-semibold">{tr.duration || "-"}</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                              tr.exitReason?.includes('TP') || tr.exitReason?.includes('Target')
                                ? 'bg-greenBrand/10 text-greenBrand border-greenBrand/30'
                                : tr.exitReason?.includes('SL') || tr.exitReason?.includes('Stop')
                                ? 'bg-redBrand/10 text-redBrand border-redBrand/30'
                                : 'bg-gray-900 text-gray-400 border-borderClr/30'
                            }`}>
                              {tr.exitReason || "Market Close"}
                            </span>
                          </td>
                          <td 
                            className={`py-2 text-right font-bold font-mono ${
                              tr.netPnL > 0 ? "text-greenBrand" : "text-redBrand"
                            }`}
                          >
                            {cur}{tr.netPnL.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
          </>
        )}

        {resultsSubTab === 'optimizer' && (
          <div className="flex flex-col gap-6 text-left">
            {/* Optimizer configurations card */}
            <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-4 bg-gray-950/40">
              <div className="flex flex-col gap-1 border-b border-borderClr/20 pb-3">
                 <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  Optimize: {STRATEGY_PRESETS[optimizerActivePreset]?.name || "Custom Strategy"}
                </h3>
                <p className="text-[10px] text-gray-500">Configure parameter search spaces and customize the optimization prompt guidelines.</p>
              </div>

              {/* Optimization Prompt box */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Strategy Guidance Prompt</span>
                <textarea
                  value={optimizationPrompt}
                  onChange={(e) => parseAndApplyPrompt(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-900 border border-borderClr/60 rounded p-2.5 text-white text-xs outline-none focus:border-amber-400 resize-none font-medium leading-relaxed"
                />
              </div>

              {/* Sweep checkboxes grid */}
              {strategyType === 'RSI_SCANNER' ? (
                <div className="flex flex-col gap-4 mt-1 border-t border-borderClr/15 pt-4 text-left">
                  {/* RSI Periods & Levels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">RSI Periods to Sweep</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[2, 3, 5, 7, 10, 14].map((p) => {
                          const isChecked = optRsiPeriodRange.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setOptRsiPeriodRange(prev =>
                                  prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p].sort((a,b)=>a-b)
                                );
                              }}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                isChecked ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-gray-900 border-borderClr/60 text-gray-500"
                              }`}
                            >
                              Period {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">RSI Levels (Overbought / Oversold)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {["85/15", "80/20", "75/25", "70/30", "60/40"].map((lvl) => {
                          const isChecked = optRsiLevelsRange.includes(lvl);
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => {
                                setOptRsiLevelsRange(prev =>
                                  prev.includes(lvl) ? prev.filter(v => v !== lvl) : [...prev, lvl]
                                );
                              }}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                isChecked ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-gray-900 border-borderClr/60 text-gray-500"
                              }`}
                            >
                              {lvl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Strike Moneyness & Target Goal */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Strike Moneyness to Sweep</span>
                      <div className="flex flex-wrap gap-1.5">
                        {["ATM", "OTM1", "OTM2"].map((m) => {
                          const isChecked = optRsiMoneynessRange.includes(m);
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setOptRsiMoneynessRange(prev =>
                                  prev.includes(m) ? prev.filter(v => v !== m) : [...prev, m]
                                );
                              }}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                isChecked ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "bg-gray-900 border-borderClr/60 text-gray-500"
                              }`}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Optimization Target Goal</span>
                      <select
                        value={optObjective}
                        onChange={(e) => setOptObjective(e.target.value)}
                        className="bg-gray-900 border border-borderClr rounded px-2.5 py-1 text-white text-xs outline-none focus:border-amber-400 cursor-pointer"
                      >
                        <option value="netPnL">Maximize Net Return</option>
                        <option value="winRate">Maximize Win Rate (%)</option>
                        <option value="sharpeRatio">Maximize Sharpe Ratio</option>
                        <option value="profitFactor">Maximize Profit Factor</option>
                        <option value="maxDrawdown">Minimize Max Drawdown (%)</option>
                      </select>
                    </div>
                  </div>

                  {/* TP & SL Sweeps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-greenBrand font-bold uppercase tracking-wider">Take Profit Sweeps (%)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[15, 20, 30, 40, 50, 80].map((val) => {
                          const isChecked = optTakeProfitRange.includes(val);
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                setOptTakeProfitRange(prev =>
                                  prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val].sort((a,b)=>a-b)
                                );
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                isChecked ? "bg-greenBrand/15 border-greenBrand/40 text-greenBrand" : "bg-gray-900 border-borderClr/60 text-gray-500"
                              }`}
                            >
                              {val}%
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-redBrand font-bold uppercase tracking-wider">Stop Loss Sweeps (%)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[10, 15, 20, 25, 30].map((val) => {
                          const isChecked = optStopLossRange.includes(val);
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                setOptStopLossRange(prev =>
                                  prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val].sort((a,b)=>a-b)
                                );
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                isChecked ? "bg-redBrand/15 border-redBrand/40 text-redBrand" : "bg-gray-900 border-borderClr/60 text-gray-500"
                              }`}
                            >
                              {val}%
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 border-t border-borderClr/15 pt-4">
                  {/* Take Profit & Stop Loss Ranges */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Take Profit Sweeps (%)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[10, 20, 30, 40, 50, 80].map((val) => {
                          const isChecked = optTakeProfitRange.includes(val);
                          return (
                            <button
                              key={val}
                              onClick={() => {
                                setOptTakeProfitRange(prev =>
                                  prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val].sort((a,b)=>a-b)
                                );
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                isChecked ? "bg-greenBrand/15 border-greenBrand/40 text-greenBrand" : "bg-gray-900 border-borderClr/60 text-gray-500"
                              }`}
                            >
                              {val}%
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Stop Loss Sweeps (%)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[10, 20, 30, 40, 50, 80].map((val) => {
                          const isChecked = optStopLossRange.includes(val);
                          return (
                            <button
                              key={val}
                              onClick={() => {
                                setOptStopLossRange(prev =>
                                  prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val].sort((a,b)=>a-b)
                                );
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                isChecked ? "bg-redBrand/15 border-redBrand/40 text-redBrand" : "bg-gray-900 border-borderClr/60 text-gray-500"
                              }`}
                            >
                              {val}%
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Entry Days & Objective selection */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Entry Days to Test</span>
                      <div className="flex gap-1.5">
                        {[
                          { label: "Mon", val: 0 },
                          { label: "Tue", val: 1 },
                          { label: "Wed", val: 2 },
                          { label: "Thu", val: 3 },
                          { label: "Fri", val: 4 }
                        ].map((d) => {
                          const isChecked = optEntryDaysRange.includes(d.val);
                          return (
                            <button
                              key={d.val}
                              onClick={() => {
                                setOptEntryDaysRange(prev =>
                                  prev.includes(d.val) ? prev.filter(v => v !== d.val) : [...prev, d.val].sort()
                                );
                              }}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                                isChecked ? "bg-amber-500/15 border-amber-500/40 text-amber-400" : "bg-gray-900 border-borderClr/60 text-gray-500"
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Optimization Target Goal</span>
                      <select
                        value={optObjective}
                        onChange={(e) => setOptObjective(e.target.value)}
                        className="bg-gray-900 border border-borderClr rounded px-2.5 py-1 text-white text-xs outline-none focus:border-amber-400"
                      >
                        {(() => {
                          const cur = getCurrencySymbol(backtestSymbol);
                          return (
                            <>
                              <option value="netPnL">Maximize Net Return ({cur})</option>
                              <option value="winRate">Maximize Win Rate (%)</option>
                              <option value="sharpeRatio">Maximize Sharpe Ratio</option>
                              <option value="profitFactor">Maximize Profit Factor</option>
                              <option value="maxDrawdown">Minimize Max Drawdown (%)</option>
                            </>
                          );
                        })()}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {backtestType === "INTRADAY" && strategyType !== "RSI_SCANNER" && (
                <div className="flex flex-col gap-1.5 mt-1 border-t border-borderClr/15 pt-3">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Intraday Entry Times Sweep</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["09:20", "09:30", "09:45", "10:15", "11:30", "13:00"].map((time) => {
                      const isChecked = optEntryTimeRange.includes(time);
                      return (
                        <button
                          key={time}
                          onClick={() => {
                            setOptEntryTimeRange(prev =>
                              prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time].sort()
                            );
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                            isChecked ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400" : "bg-gray-900 border-borderClr/60 text-gray-500"
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strike Width Sweep */}
              {strategyType !== 'RSI_SCANNER' && (
                <div className="flex flex-col gap-1.5 mt-1 border-t border-borderClr/15 pt-3">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Strike Distance Sweeps (Points)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(DEFAULT_STRIKE_WIDTHS[backtestSymbol.toUpperCase()] || [50, 100, 150, 200]).map((width) => {
                      const isChecked = optStrikeWidthRange.includes(width);
                      return (
                        <button
                          key={width}
                          type="button"
                          onClick={() => {
                            setOptStrikeWidthRange(prev =>
                              prev.includes(width) ? prev.filter(w => w !== width) : [...prev, width].sort((a,b)=>a-b)
                            );
                          }}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                            isChecked ? "bg-amber-500/15 border-amber-500/40 text-amber-400" : "bg-gray-900 border-borderClr/60 text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {width}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Direction & OTM Placement Sweep */}
              {strategyType !== 'RSI_SCANNER' && (
                <div className="flex flex-col gap-1.5 mt-1 border-t border-borderClr/15 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Direction & OTM Placement Sweeps (Points from ATM)</span>
                    <span className="text-[9px] text-amber-400 font-medium">Test Bullish / Bearish / OTM Ratio Wings</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(DEFAULT_DIRECTION_OFFSETS[backtestSymbol.toUpperCase()] || [
                      { label: "-200 P-OTM", offset: -200 },
                      { label: "-100 P-OTM", offset: -100 },
                      { label: "ATM (0)", offset: 0 },
                      { label: "+100 C-OTM", offset: 100 },
                      { label: "+200 C-OTM", offset: 200 }
                    ]).map((item) => {
                      const isChecked = optDirectionOffsetRange.includes(item.offset);
                      return (
                        <button
                          key={item.offset}
                          type="button"
                          onClick={() => {
                            setOptDirectionOffsetRange(prev =>
                              prev.includes(item.offset) ? prev.filter(o => o !== item.offset) : [...prev, item.offset].sort((a,b)=>a-b)
                            );
                          }}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                            isChecked ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm" : "bg-gray-900 border-borderClr/60 text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Start Sweep Button */}
              <button
                onClick={handleRunOptimization}
                disabled={isOptimizing}
                className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-900 disabled:to-gray-950 disabled:text-gray-600 text-black font-extrabold rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isOptimizing ? (
                  <Activity className="w-4 h-4 animate-spin text-amber-500" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5" />
                )}
                {isOptimizing ? "Sweeping Permutation Space..." : "Run AI Parameter Sweep"}
              </button>
            </div>

            {/* Optimization Results Table */}
            {optimizationResults.length > 0 && (
              <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-3 bg-gray-950/40 overflow-x-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-borderClr/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Ranked Parameter Permutations ({optimizationResults.length})
                    </span>
                    <span className="text-[10px] text-amber-400 font-extrabold uppercase">Sorted by: {optObjective}</span>
                  </div>
                  <button
                    onClick={handleExportOptimizerCSV}
                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500 hover:text-black border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="Download Permutations as CSV Spreadsheet"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Permutations CSV
                  </button>
                </div>

                <div className="max-h-[350px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-[11px] border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-borderClr/20 text-gray-500 select-none">
                        <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('rank')}>
                          Rank {renderSortIndicator('rank')}
                        </th>
                        {strategyType === 'RSI_SCANNER' ? (
                          <>
                            <th className="py-2 text-emerald-400">RSI Period</th>
                            <th className="py-2 text-emerald-400">Levels (OB/OS)</th>
                            <th className="py-2 text-cyan-400">Strike</th>
                            <th className="py-2 text-greenBrand">Take Profit</th>
                            <th className="py-2 text-redBrand">Stop Loss</th>
                          </>
                        ) : (
                          <>
                            <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('directionOffset')}>
                              OTM / Direction {renderSortIndicator('directionOffset')}
                            </th>
                            <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('stopLoss')}>
                              Stop Loss {renderSortIndicator('stopLoss')}
                            </th>
                            <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('takeProfit')}>
                              Take Profit {renderSortIndicator('takeProfit')}
                            </th>
                            <th className="py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('strikeWidth')}>
                              Spread {renderSortIndicator('strikeWidth')}
                            </th>
                            <th className="py-2">Days / Time</th>
                          </>
                        )}
                        <th className="py-2 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('netReturn')}>
                          Net Return {renderSortIndicator('netReturn')}
                        </th>
                        <th className="py-2 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('winRate')}>
                          Win Rate {renderSortIndicator('winRate')}
                        </th>
                        <th className="py-2 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('maxDrawdown')}>
                          Max DD {renderSortIndicator('maxDrawdown')}
                        </th>
                        <th className="py-2 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('profitFactor')}>
                          Prof Factor {renderSortIndicator('profitFactor')}
                        </th>
                        <th className="py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedOptimizationResults.map((row) => {
                        const p = row.parameters;
                        const m = row.metrics;
                        const originalRank = optimizationResults.indexOf(row) + 1;
                        const isBest = originalRank === 1;

                        const daysMap = ["M", "T", "W", "Th", "F"];
                        const daysStr = p.entryDays ? p.entryDays.map((d: number) => daysMap[d]).join(",") : "";

                        return (
                          <tr key={originalRank} className={`border-b border-borderClr/10 text-gray-300 hover:bg-gray-900/40 ${isBest ? 'bg-amber-500/5' : ''}`}>
                            <td className="py-2.5 font-bold text-white flex items-center gap-1">
                              {isBest && <span className="text-amber-500 text-[10px]">★</span>}
                              #{originalRank}
                            </td>
                            {strategyType === 'RSI_SCANNER' ? (
                              <>
                                <td className="py-2.5 font-bold text-emerald-400">RSI({p.rsiPeriod})</td>
                                <td className="py-2.5 font-semibold text-gray-300">{p.rsiLower}/{p.rsiUpper}</td>
                                <td className="py-2.5 font-bold text-cyan-300">{p.moneyness}</td>
                                <td className="py-2.5 font-semibold text-greenBrand">+{p.takeProfitPct}%</td>
                                <td className="py-2.5 font-semibold text-redBrand">-{p.stopLossPct}%</td>
                              </>
                            ) : (
                              <>
                                <td className="py-2.5 font-semibold">
                                  {p.directionOffset !== null && p.directionOffset !== undefined && p.directionOffset !== 0 ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${p.directionOffset > 0 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-pink-500/10 text-pink-400 border-pink-500/30'}`}>
                                      {p.directionOffset > 0 ? `+${p.directionOffset} C-OTM` : `${p.directionOffset} P-OTM`}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 font-mono text-[10px]">ATM (0)</span>
                                  )}
                                </td>
                                <td className="py-2.5">
                                  {p.stopLossPct !== null ? (
                                    <span className="text-redBrand font-semibold">{p.stopLossPct}%</span>
                                  ) : (
                                    <span className="text-gray-500">None</span>
                                  )}
                                </td>
                                <td className="py-2.5">
                                  {p.takeProfitPct !== null ? (
                                    <span className="text-greenBrand font-semibold">{p.takeProfitPct}%</span>
                                  ) : (
                                    <span className="text-gray-500">None</span>
                                  )}
                                </td>
                                <td className="py-2.5 font-semibold text-white">
                                  {p.strikeWidth !== null && p.strikeWidth !== undefined ? (
                                    <span>{p.strikeWidth}</span>
                                  ) : (
                                    <span className="text-gray-500">Original</span>
                                  )}
                                </td>
                                <td className="py-2.5 text-gray-400">
                                  <span>{daysStr}</span>
                                  {p.entryTime && <span className="text-[10px] ml-1 bg-gray-900 px-1 py-0.5 rounded text-gray-400">{p.entryTime}</span>}
                                </td>
                              </>
                            )}
                            <td className={`py-2.5 text-right font-bold ${m.netPnL >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                              {(() => {
                                const cur = getCurrencySymbol(backtestSymbol);
                                return `${cur}${m.netPnL.toLocaleString()} (${m.netReturnPct}%)`;
                              })()}
                            </td>
                            <td className="py-2.5 text-right text-greenBrand font-semibold">{m.winRate}%</td>
                            <td className="py-2.5 text-right text-redBrand font-semibold">{m.maxDrawdown}%</td>
                            <td className="py-2.5 text-right text-white font-semibold">{m.profitFactor}</td>
                            <td className="py-2.5 text-center">
                              <button
                                onClick={() => handleApplyOptimalConfig(row)}
                                className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500 hover:text-black border border-amber-500/30 text-amber-400 rounded text-[10px] font-bold transition-all cursor-pointer"
                              >
                                Apply
                              </button>
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
        )}
      </div>
    </div>
  );
};
