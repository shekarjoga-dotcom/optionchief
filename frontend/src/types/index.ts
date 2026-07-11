export interface Underlying {
  symbol: string;
  ticker: string;
  spot: number;
  open: number;
  high: number;
  low: number;
  previous_close: number;
  change: number;
  pct_change: number;
  volume: number;
}

export interface OptionContract {
  strike: number;
  optionType: 'C' | 'P';
  lastPrice: number;
  bid: number;
  ask: number;
  change: number;
  pctChange: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  oiAnalysis: string; // "Long Buildup", "Short Buildup", etc.
  delta?: number;
  bidQty?: number;
  askQty?: number;
  bidIv?: number;
  askIv?: number;
}

export interface StrikeChain {
  strike: number;
  CE: OptionContract | null;
  PE: OptionContract | null;
}

export interface OptionChainData {
  underlying: Underlying;
  expiry_dates: string[];
  selected_expiry: string;
  pcr: number;
  options: StrikeChain[];
}

export interface StrategyLeg {
  id: string;
  strike: number;
  optionType: 'C' | 'P' | 'F';
  expiry: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  iv: number;
  status?: 'ACTIVE' | 'SQUARED_OFF';
  realizedPnL?: number;
}

export interface SavedPortfolio {
  id: string;
  name: string;
  symbol: string;
  description?: string;
  legs: StrategyLeg[];
  createdAt?: string;
  marginDeployed?: number;
  realizedPnL?: number;
  entrySpot?: number;
  peakProfit?: number;
  maxDrawdown?: number;
  takeProfit?: number;
  stopLoss?: number;
}

export interface AlertRule {
  id: string;
  strategyType: string;
  minPop: number;
  minRR: number;
  minLoss?: number;
  maxLoss: number;
  active: boolean;
  expiry: string;
  symbol: string;
  minDelta?: number;
  maxDelta?: number;
  minTheta?: number;
  maxGamma?: number;
  autoExecute?: boolean;
  takeProfit?: number;
  stopLoss?: number;
}

export interface TriggeredAlert {
  id: string;
  symbol: string;
  strategyName: string;
  expiry: string;
  pop: number;
  maxProfit: string | number;
  maxLoss: string | number;
  rrRatio: number;
  timestamp: string;
  ruleId: string;
  legs: StrategyLeg[];
  spotPrice?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
}

