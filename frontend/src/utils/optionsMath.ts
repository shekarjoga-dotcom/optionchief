/**
 * TypeScript implementation of Black-Scholes-Merton (BSM) equations,
 * Greeks calculation, and strategy PnL projection.
 * Designed for ultra-high performance client-side updates (60fps sliders).
 */

// Cumulative standard normal distribution approximation (Abramowitz and Stegun)
export function cdfNormal(x: number): number {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const d = 0.39894228 * Math.exp(-0.5 * x * x);
  const p = (((((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.31938153) * t) * d;
  if (x >= 0) {
    return 1.0 - p;
  } else {
    return p;
  }
}

// Probability density function of standard normal distribution
export function pdfNormal(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

// Robust date parsing to prevent browser-specific NaN parsing errors (e.g., Safari with dashes)
export function parseExpiryDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  try {
    const parts = dateStr.split(/[-/ ]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) { // YYYY-MM-DD
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const day = parseInt(parts[0], 10);
      const monthStr = parts[1].toLowerCase().substring(0, 3);
      const year = parseInt(parts[2], 10);
      if (monthStr in months) {
        return new Date(year, months[monthStr], day);
      }
    }
  } catch {}
  return new Date();
}


/**
 * Calculates theoretical option price using BSM.
 * S = Spot Price, K = Strike Price, T = Time to expiry in years,
 * r = Risk-free rate (decimal), sigma = Volatility (decimal), optionType = 'C' | 'P', q = dividend yield
 */
export function bsPricing(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionType: 'C' | 'P',
  q = 0.0
): number {
  if (T <= 0) {
    if (optionType === 'C') return Math.max(0, S - K);
    return Math.max(0, K - S);
  }
  if (sigma <= 0) {
    if (optionType === 'C') return Math.max(0, S * Math.exp(-q * T) - K * Math.exp(-r * T));
    return Math.max(0, K * Math.exp(-r * T) - S * Math.exp(-q * T));
  }

  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  if (optionType === 'C') {
    return S * Math.exp(-q * T) * cdfNormal(d1) - K * Math.exp(-r * T) * cdfNormal(d2);
  } else {
    return K * Math.exp(-r * T) * cdfNormal(-d2) - S * Math.exp(-q * T) * cdfNormal(-d1);
  }
}

/**
 * Calculates individual option Greeks.
 */
export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
}

export function bsGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionType: 'C' | 'P',
  q = 0.0
): Greeks {
  if (T <= 0) {
    const val = optionType === 'C' ? S - K : K - S;
    return {
      price: Math.max(0, val),
      delta: optionType === 'C' ? (S > K ? 1.0 : 0.0) : (K > S ? -1.0 : 0.0),
      gamma: 0.0,
      vega: 0.0,
      theta: 0.0,
    };
  }

  const vol = Math.max(0.0001, sigma);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * vol * vol) * T) / (vol * Math.sqrt(T));
  const d2 = d1 - vol * Math.sqrt(T);

  const pdfD1 = pdfNormal(d1);
  const price = bsPricing(S, K, T, r, vol, optionType, q);

  let delta = 0;
  let theta = 0;

  if (optionType === 'C') {
    delta = Math.exp(-q * T) * cdfNormal(d1);
    const term1 = -(S * Math.exp(-q * T) * pdfD1 * vol) / (2 * Math.sqrt(T));
    const term2 = -r * K * Math.exp(-r * T) * cdfNormal(d2);
    const term3 = q * S * Math.exp(-q * T) * cdfNormal(d1);
    theta = term1 + term2 + term3;
  } else {
    delta = -Math.exp(-q * T) * cdfNormal(-d1);
    const term1 = -(S * Math.exp(-q * T) * pdfD1 * vol) / (2 * Math.sqrt(T));
    const term2 = r * K * Math.exp(-r * T) * cdfNormal(-d2);
    const term3 = -q * S * Math.exp(-q * T) * cdfNormal(-d1);
    theta = term1 + term2 + term3;
  }

  const gamma = Math.exp(-q * T) * pdfD1 / (S * vol * Math.sqrt(T));
  const vega = S * Math.exp(-q * T) * pdfD1 * Math.sqrt(T); // total vega

  return {
    price,
    delta,
    gamma,
    vega: vega / 100.0,    // per 1% IV change
    theta: theta / 365.0,  // per calendar day decay
  };
}

/**
 * Strategy Leg interface
 */
export interface StrategyLeg {
  id: string;
  strike: number;
  optionType: 'C' | 'P' | 'F'; // Call, Put, Future
  expiry: string;              // YYYY-MM-DD
  action: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  iv: number;
}

/**
 * Calculate the price of a single leg under given spot, volatility override and time offset.
 * daysPassed: number of days to shift forward from today.
 */
export function calculateLegPrice(
  leg: StrategyLeg,
  spotPrice: number,
  daysPassed: number,
  ivOffsetPct: number,
  r = 0.05
): number {
  if (leg.optionType === 'F') {
    // Future payoff is linear: Buy = spot - entry, Sell = entry - spot
    return spotPrice;
  }

  const today = new Date();
  const expiryDate = parseExpiryDate(leg.expiry);
  const totalDays = Math.max(1, Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  
  const remainingDays = Math.max(0, totalDays - daysPassed);
  const T = remainingDays / 365.0;
  
  // Calculate leg-specific volatility
  const legIv = Math.max(0.01, leg.iv * (1 + ivOffsetPct / 100.0));

  return bsPricing(spotPrice, leg.strike, T, r, legIv, leg.optionType);
}

/**
 * Project PnL for a leg at a specific spotPrice.
 * Returns: price of contract, and PnL contribution.
 */
export function projectLegPnL(
  leg: StrategyLeg,
  spotPrice: number,
  daysPassed: number,
  ivOffsetPct: number
): { pnl: number; currentVal: number; price: number } {
  const price = calculateLegPrice(leg, spotPrice, daysPassed, ivOffsetPct);
  let pnl = 0;

  if (leg.optionType === 'F') {
    // Future logic
    const diff = spotPrice - leg.entryPrice;
    pnl = leg.action === 'BUY' ? diff * leg.quantity : -diff * leg.quantity;
    return { pnl, currentVal: spotPrice * leg.quantity, price: spotPrice };
  }

  // Options logic
  const entryVal = leg.entryPrice * leg.quantity;
  const currentVal = price * leg.quantity;

  if (leg.action === 'BUY') {
    pnl = currentVal - entryVal;
  } else {
    pnl = entryVal - currentVal;
  }

  return { pnl, currentVal, price };
}

/**
 * Project Combined Strategy PnL and Greeks across a range of spot prices.
 */
export interface PayoffPoint {
  price: number;
  pnlCurrent: number;   // PnL at T + daysPassed
  pnlExpiration: number;// PnL at expiry (remaining days = 0)
}

export interface StrategyMetrics {
  maxProfit: number | string; // "Unlimited" or number
  maxLoss: number | string; // "Unlimited" or number
  breakEvens: number[];
  netDebitCredit: number; // Positive = credit (gain), Negative = debit (cost)
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  pop: number; // Probability of Profit (%)
  marginRequirement: number; // Margin in currency (mock)
}

function calculateMarginRequirement(legs: StrategyLeg[], symbol?: string): number {
  let margin = 0;
  
  const calls = legs.filter(l => l.optionType === 'C');
  const puts = legs.filter(l => l.optionType === 'P');
  const futures = legs.filter(l => l.optionType === 'F');

  // Short futures margin
  for (const f of futures) {
    if (f.action === 'SELL' || f.action === 'BUY') {
      const symUpper = symbol?.toUpperCase() || "";
      let futMarginPerUnit = 1000; // default (100,000 for lot of 100)
      if (symUpper === "GOLD" || symUpper === "GOLDM") futMarginPerUnit = 24000;
      else if (symUpper === "SILVER" || symUpper === "SILVERM") futMarginPerUnit = 10000;
      else if (symUpper === "CRUDEOIL" || symUpper === "CRUDEOILM") futMarginPerUnit = 750;
      else if (symUpper === "NATURALGAS" || symUpper === "NATGASMINI") futMarginPerUnit = 40;
      else {
        const lotVal = getLotSizeForSymbol(symUpper);
        futMarginPerUnit = 100000 / lotVal;
      }
      
      margin += futMarginPerUnit * f.quantity;
    }
  }

  // Helper for options margin:
  // Short naked option margin = 150,000 INR/USD
  // If hedged by long option of same type, margin is halved
  const calculateOptionsGroupMargin = (group: StrategyLeg[]) => {
    const shorts = group.filter(l => l.action === 'SELL');
    const longs = group.filter(l => l.action === 'BUY');
    
    let groupMargin = 0;
    for (const s of shorts) {
      const hasHedge = longs.some(l => l.expiry === s.expiry);
      const symUpper = symbol?.toUpperCase() || "";
      
      let baseMarginPerUnit = 1500; // default (150,000 for lot of 100)
      if (symUpper === "GOLD" || symUpper === "GOLDM") {
        baseMarginPerUnit = 24000; // 240,000 for lot of 10 (GOLDM) or 24L for lot of 100 (GOLD)
      } else if (symUpper === "SILVER" || symUpper === "SILVERM") {
        baseMarginPerUnit = 10000;
      } else if (symUpper === "CRUDEOIL" || symUpper === "CRUDEOILM") {
        baseMarginPerUnit = 750;
      } else if (symUpper === "NATURALGAS" || symUpper === "NATGASMINI") {
        baseMarginPerUnit = 40;
      } else {
        const lotVal = getLotSizeForSymbol(symUpper);
        baseMarginPerUnit = 150000 / lotVal;
      }
      
      const multiplier = hasHedge ? 0.2 : 1.0;
      groupMargin += baseMarginPerUnit * s.quantity * multiplier;
    }
    return groupMargin;
  };

  margin += calculateOptionsGroupMargin(calls);
  margin += calculateOptionsGroupMargin(puts);

  return margin;
}

export function projectStrategy(
  legs: StrategyLeg[],
  spotPrice: number,
  daysPassed: number,
  ivOffsetPct: number,
  r = 0.05,
  symbol?: string
): { payoff: PayoffPoint[]; metrics: StrategyMetrics } {
  const payoff: PayoffPoint[] = [];

  // Define steps around spot (e.g. +/- 20% spot range)
  // Dynamically calculate x-axis range based on option strikes to make payoff curves clear
  let minPrice = Math.max(1.0, spotPrice * 0.8);
  let maxPrice = spotPrice * 1.2;

  if (legs.length > 0) {
    const strikes = legs.map(l => l.strike);
    const minStrike = Math.min(...strikes, spotPrice);
    const maxStrike = Math.max(...strikes, spotPrice);
    const diff = maxStrike - minStrike;
    
    // Add buffer of at least 3% of spot or 30% of the diff to zoom in on the transition region
    const buffer = Math.max(spotPrice * 0.03, diff * 0.3);
    minPrice = Math.max(1.0, minStrike - buffer);
    maxPrice = maxStrike + buffer;
  }

  const rangeWidth = maxPrice - minPrice;
  const step = rangeWidth / 100; // 100 steps for higher resolution curve

  // 1. Calculate payoff curve points
  for (let p = minPrice; p <= maxPrice; p += step) {
    let pnlCurrent = 0;
    let pnlExpiration = 0;

    for (const leg of legs) {
      // Current PnL (T+daysPassed)
      const current = projectLegPnL(leg, p, daysPassed, ivOffsetPct);
      pnlCurrent += current.pnl;

      // Expiration PnL (T+expiry)
      const expiry = projectLegPnL(leg, p, 365, ivOffsetPct);
      pnlExpiration += expiry.pnl;
    }

    payoff.push({
      price: Math.round(p * 100) / 100,
      pnlCurrent: Math.round(pnlCurrent * 100) / 100,
      pnlExpiration: Math.round(pnlExpiration * 100) / 100,
    });
  }

  // 2. Aggregate Greeks
  let aggDelta = 0;
  let aggGamma = 0;
  let aggVega = 0;
  let aggTheta = 0;

  for (const leg of legs) {
    if (leg.optionType === 'F') {
      const sign = leg.action === 'BUY' ? 1 : -1;
      aggDelta += sign * leg.quantity;
      continue;
    }

    const today = new Date();
    const expiryDate = parseExpiryDate(leg.expiry);
    const totalDays = Math.max(1, Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    const remainingDays = Math.max(0, totalDays - daysPassed);
    const T = remainingDays / 365.0;
    const legIv = Math.max(0.01, leg.iv * (1 + ivOffsetPct / 100.0));

    const greeks = bsGreeks(spotPrice, leg.strike, T, r, legIv, leg.optionType);
    const sign = leg.action === 'BUY' ? 1 : -1;

    aggDelta += greeks.delta * sign * leg.quantity;
    aggGamma += greeks.gamma * sign * leg.quantity;
    aggVega += greeks.vega * sign * leg.quantity;
    aggTheta += greeks.theta * sign * leg.quantity;
  }

  // 3. Net Debit / Credit
  let netDebitCredit = 0;
  for (const leg of legs) {
    const sign = leg.action === 'BUY' ? -1 : 1;
    netDebitCredit += sign * leg.entryPrice * leg.quantity;
  }

  // 4. Piecewise Max Profit / Max Loss Evaluation
  // Evaluate at strike prices, S = 0, and S = spot * 3 (representing infinity)
  const candidatePrices = [0, ...legs.map(l => l.strike), spotPrice * 3];
  let pieceMax = -Infinity;
  let pieceMin = Infinity;

  for (const p of candidatePrices) {
    let pnlAtExpiry = 0;
    for (const leg of legs) {
      const expiry = projectLegPnL(leg, p, 365, ivOffsetPct);
      pnlAtExpiry += expiry.pnl;
    }
    if (pnlAtExpiry > pieceMax) pieceMax = pnlAtExpiry;
    if (pnlAtExpiry < pieceMin) pieceMin = pnlAtExpiry;
  }

  // Check if profit is unlimited at extremes (S=0 or S=spot*3)
  let isProfitUnlimited = false;
  let isLossUnlimited = false;
  let pnlAtZero = 0;
  let pnlAtInfinity = 0;
  for (const leg of legs) {
    pnlAtZero += projectLegPnL(leg, 0, 365, ivOffsetPct).pnl;
    pnlAtInfinity += projectLegPnL(leg, spotPrice * 3, 365, ivOffsetPct).pnl;
  }
  const lotValForLimit = getLotSizeForSymbol(symbol || "");
  const limitThreshold = spotPrice * 5 * lotValForLimit;
  if (pnlAtZero > limitThreshold || pnlAtInfinity > limitThreshold) {
    isProfitUnlimited = true;
  }
  if (pnlAtZero < -limitThreshold || pnlAtInfinity < -limitThreshold) {
    isLossUnlimited = true;
  }

  const finalMaxProfit = isProfitUnlimited ? 'Unlimited' : pieceMax;
  const finalMaxLoss = isLossUnlimited ? 'Unlimited' : Math.min(0, pieceMin);

  // Find break evens (where expiry PnL crosses 0)
  const breakEvens: number[] = [];
  for (let i = 0; i < payoff.length - 1; i++) {
    const p1 = payoff[i];
    const p2 = payoff[i + 1];
    if ((p1.pnlExpiration <= 0 && p2.pnlExpiration > 0) || (p1.pnlExpiration > 0 && p2.pnlExpiration <= 0)) {
      const denominator = p2.pnlExpiration - p1.pnlExpiration;
      if (denominator !== 0) {
        const weight = (0 - p1.pnlExpiration) / denominator;
        const crossover = p1.price + weight * (p2.price - p1.price);
        if (!isNaN(crossover) && isFinite(crossover)) {
          breakEvens.push(Math.round(crossover * 100) / 100);
        }
      }
    }
  }

  // 5. Probability of Profit (POP) Calculation
  let pop = 50.0; // default 50%
  const avgIv = legs.length > 0 ? (legs.reduce((acc, l) => acc + l.iv, 0) / legs.length) : 0.16;

  const getD2 = (K: number) => {
    try {
      const vol = Math.max(0.01, avgIv * (1 + ivOffsetPct / 100.0));
      const totalDays = Math.max(1, Math.round((parseExpiryDate(legs[0].expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

      const remainingDays = Math.max(0, totalDays - daysPassed);
      const T = Math.max(1, remainingDays) / 365.0;
      const d1 = (Math.log(spotPrice / K) + (r + 0.5 * vol * vol) * T) / (vol * Math.sqrt(T));
      return d1 - vol * Math.sqrt(T);
    } catch {
      return 0.0;
    }
  };

  const sortedBE = [...breakEvens]
    .filter(be => typeof be === 'number' && !isNaN(be) && isFinite(be))
    .sort((a, b) => a - b);
  if (sortedBE.length === 0) {
    // Check if payoff is completely in profit or loss
    const midpointPayoff = payoff[Math.floor(payoff.length / 2)].pnlExpiration;
    pop = midpointPayoff > 0 ? 100.0 : 0.0;
  } else if (sortedBE.length === 1) {
    const beVal = sortedBE[0];
    const d2 = getD2(beVal);
    // Bullish vs Bearish: check combined strategy PnL slightly above BE (not just first leg)
    let pnlSlightlyAbove = 0;
    for (const leg of legs) {
      pnlSlightlyAbove += projectLegPnL(leg, beVal + 10, 365, ivOffsetPct).pnl;
    }
    const isBullish = pnlSlightlyAbove > 0;
    pop = isBullish ? cdfNormal(d2) * 100.0 : cdfNormal(-d2) * 100.0;
  } else {
    // Range crossover (usually 2 or more BEs)
    const lowerBE = sortedBE[0];
    const upperBE = sortedBE[sortedBE.length - 1];
    const d2_lower = getD2(lowerBE);
    const d2_upper = getD2(upperBE);
    
    // Check if profit is INSIDE or OUTSIDE the range (e.g. short strangle vs long strangle)
    const midPoint = (lowerBE + upperBE) / 2.0;
    let profitInside = false;
    let midPayoff = 0;
    for (const leg of legs) {
      midPayoff += projectLegPnL(leg, midPoint, 365, ivOffsetPct).pnl;
    }
    profitInside = midPayoff > 0;

    const rangeProb = Math.abs(cdfNormal(d2_lower) - cdfNormal(d2_upper)) * 100.0;
    pop = profitInside ? rangeProb : (100.0 - rangeProb);
  }

  // 6. Margin Requirement calculation
  const marginRequirement = calculateMarginRequirement(legs, symbol);

  return {
    payoff,
    metrics: {
      maxProfit: typeof finalMaxProfit === 'number' ? Math.round(finalMaxProfit * 100) / 100 : finalMaxProfit,
      maxLoss: typeof finalMaxLoss === 'number' ? Math.round(finalMaxLoss * 100) / 100 : finalMaxLoss,
      breakEvens: sortedBE,
      netDebitCredit: Math.round(netDebitCredit * 100) / 100,
      delta: Math.round(aggDelta * 100) / 100,
      gamma: Math.round(aggGamma * 400) / 400,
      vega: Math.round(aggVega * 100) / 100,
      theta: Math.round(aggTheta * 100) / 100,
      pop: Math.round(Math.max(0.0, Math.min(100.0, pop)) * 10) / 10,
      marginRequirement
    },
  };
}

export function getLotSizeForSymbol(sym: string): number {
  let s = (sym || "").toUpperCase();
  if (s.endsWith("1!")) {
    s = s.slice(0, -2);
  }
  if (s === "NATURALGASM") return 250;
  if (s === "CRUDEM") return 10;

  // Indian Indices
  if (s === "NIFTY") return 65;
  if (s === "BANKNIFTY") return 30;
  if (s === "SENSEX") return 20;
  if (s === "FINNIFTY") return 60;
  if (s === "MIDCPNIFTY") return 120;

  // NSE F&O Stocks mapping
  const stockLots: Record<string, number> = {
    "RELIANCE": 250, "TCS": 175, "HDFCBANK": 550, "ICICIBANK": 700, "INFY": 400,
    "BHARTIARTL": 950, "ITC": 1600, "LT": 300, "SBIN": 750, "HINDUNILVR": 300,
    "LTIM": 150, "HCLTECH": 350, "AXISBANK": 625, "ASIANPAINT": 200, "KOTAKBANK": 400,
    "MARUTI": 100, "SUNPHARMA": 700, "NTPC": 1500, "TATAMOTORS": 1425, "COALINDIA": 2100,
    "TATASTEEL": 5500, "ONGC": 3850, "ADANIENT": 300, "JSWSTEEL": 675, "TITAN": 375,
    "POWERGRID": 3600, "M&M": 350, "ULTRACEMCO": 100, "BAJFINANCE": 125, "GRASIM": 475,
    "HINDALCO": 1400, "BPCL": 1800, "HEROMOTOCO": 300, "NESTLEIND": 400, "CIPLA": 650,
    "WIPRO": 1500, "ADANIPORTS": 400, "APOLLOHOSP": 125, "DIVISLAB": 150, "TATACONSUM": 900,
    "DRREDDY": 125, "BAJAJFINSV": 500, "EICHERMOT": 175, "JINDALSTEL": 1250, "HDFCLIFE": 1100,
    "SHRIRAMFIN": 250, "INDUSINDBK": 500, "BRITANNIA": 200, "TECHM": 600
  };

  if (stockLots[s] !== undefined) {
    return stockLots[s];
  }
  
  if (s === "GOLD") return 100;
  if (s === "GOLDM") return 10;
  if (s === "SILVER") return 30;
  if (s === "SILVERM") return 5;
  if (s === "CRUDEOIL") return 100;
  if (s === "CRUDEOILM") return 10;
  if (s === "NATURALGAS") return 1250;
  if (s === "NATGASMINI") return 250;
  
  if (s === "BTC") return 1;
  if (s === "ETH") return 1;
  
  return 100;
}

export function normalizeLegQuantities(legs: StrategyLeg[], symbol: string): StrategyLeg[] {
  if (!legs || legs.length === 0) return [];
  const correctLot = getLotSizeForSymbol(symbol);
  
  // Find the minimum quantity across all legs to use as the base lot size divisor
  const quantities = legs.map(l => l.quantity);
  const minQty = Math.min(...quantities);
  if (minQty <= 0) return legs;

  return legs.map(leg => {
    // Calculate the ratio relative to the min leg quantity
    const ratio = leg.quantity / minQty;
    // Map to new quantity using correct lot size
    const newQty = Math.round(ratio * correctLot);
    return {
      ...leg,
      quantity: newQty
    };
  });
}

export function getCurrencySymbol(sym: string): string {
  let s = (sym || "").toUpperCase();
  if (s.endsWith("1!")) {
    s = s.slice(0, -2);
  }
  // List of symbols denominated in USD
  const isUSOrCrypto = ["SPY", "QQQ", "IWM", "AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "GOOGL", "META", "BTC", "ETH"].includes(s);
  return isUSOrCrypto ? "$" : "₹";
}


