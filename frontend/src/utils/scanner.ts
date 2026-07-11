import type { StrikeChain, StrategyLeg } from '../types';
import { projectStrategy } from './optionsMath';

export interface ScannedStrategy {
  name: string;
  legs: StrategyLeg[];
  pop: number;
  maxProfit: number | string;
  maxLoss: number | string;
  netDebitCredit: number;
  margin: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  description: string;
  distance: number;
  expiry: string;
  symbol?: string;
  spot?: number;
}


export function scanStrategies(
  strategyType: string,
  options: StrikeChain[],
  spot: number,
  selectedExpiry: string,
  wingWidth: number, // in strike increments, e.g. 2
  minDist: number,   // in strike increments, e.g. 4
  maxDist: number,   // in strike increments, e.g. 20
  step: number,      // strike scan step, e.g. 1
  lotSize: number,
  r = 0.05,
  symbol?: string
): ScannedStrategy[] {
  if (options.length < 5) return [];

  // Find ATM strike index
  const sortedStrikes = [...options].sort((a, b) => a.strike - b.strike);
  const strikesList = sortedStrikes.map(o => o.strike);
  
  // Find index of ATM strike closest to spot
  const atmStrike = sortedStrikes.reduce((prev, curr) => {
    return Math.abs(curr.strike - spot) < Math.abs(prev.strike - spot) ? curr : prev;
  }).strike;
  const atmIdx = strikesList.indexOf(atmStrike);

  if (atmIdx === -1) return [];

  const results: ScannedStrategy[] = [];

  const getLegHelper = (strike: number, type: 'C' | 'P', action: 'BUY' | 'SELL'): StrategyLeg | null => {
    const row = sortedStrikes.find(o => o.strike === strike);
    if (!row) return null;
    const contract = type === 'C' ? row.CE : row.PE;
    if (!contract) return null;

    return {
      id: Math.random().toString(36).substring(2, 9),
      strike,
      optionType: type,
      expiry: selectedExpiry,
      action,
      quantity: lotSize,
      entryPrice: contract.lastPrice || 1.0,
      currentPrice: contract.lastPrice || 1.0,
      iv: contract.impliedVolatility || 0.16
    };
  };

  // Helper to run full strategy projection and return standardized scan result
  const buildScanResult = (name: string, legs: StrategyLeg[], desc: string): ScannedStrategy | null => {
    // If any leg failed to find quotes, return null
    if (legs.some(l => l === null)) return null;

    const projection = projectStrategy(legs, spot, 0, 0, r, symbol);
    const m = projection.metrics;

    // Calculate distance as average distance of short legs from spot
    const sellLegs = legs.filter(l => l.action === 'SELL');
    const distance = sellLegs.length > 0
      ? Math.round(sellLegs.reduce((sum, l) => sum + Math.abs(l.strike - spot), 0) / sellLegs.length)
      : 0;

    return {
      name,
      legs,
      pop: m.pop,
      maxProfit: m.maxProfit,
      maxLoss: m.maxLoss,
      netDebitCredit: m.netDebitCredit,
      margin: m.marginRequirement,
      delta: m.delta,
      gamma: m.gamma,
      theta: m.theta,
      vega: m.vega,
      description: desc,
      distance,
      expiry: selectedExpiry,
      symbol,
      spot
    };
  };

  const typeUpper = strategyType.toUpperCase();

  // 1. IRON CONDOR / HEDGED SHORT STRANGLE (Neutral / Safe Hedged)
  if (typeUpper === "IRON CONDOR" || typeUpper === "HEDGED SHORT STRANGLE") {
    const isStrangleName = typeUpper === "HEDGED SHORT STRANGLE";
    const namePrefix = isStrangleName ? "Hedged Short Strangle" : "Iron Condor";
    for (let sPutOff = minDist; sPutOff <= maxDist; sPutOff += step) {
      for (let sCallOff = minDist; sCallOff <= maxDist; sCallOff += step) {
        const shortPutIdx = atmIdx - sPutOff;
        const longPutIdx = shortPutIdx - wingWidth;
        const shortCallIdx = atmIdx + sCallOff;
        const longCallIdx = shortCallIdx + wingWidth;

        if (longPutIdx >= 0 && longCallIdx < strikesList.length) {
          const lPut = getLegHelper(strikesList[longPutIdx], 'P', 'BUY');
          const sPut = getLegHelper(strikesList[shortPutIdx], 'P', 'SELL');
          const sCall = getLegHelper(strikesList[shortCallIdx], 'C', 'SELL');
          const lCall = getLegHelper(strikesList[longCallIdx], 'C', 'BUY');

          if (lPut && sPut && sCall && lCall) {
            const scanRes = buildScanResult(
              `${namePrefix} (${strikesList[longPutIdx]}/${strikesList[shortPutIdx]}/${strikesList[shortCallIdx]}/${strikesList[longCallIdx]})`,
              [lPut, sPut, sCall, lCall],
              isStrangleName
                ? `Hedged Strangle: Sell Put at ${strikesList[shortPutIdx]} and Sell Call at ${strikesList[shortCallIdx]}, protected by wings at ${strikesList[longPutIdx]} and ${strikesList[longCallIdx]}.`
                : `Sell Put Spread at ${strikesList[shortPutIdx]} & Sell Call Spread at ${strikesList[shortCallIdx]}.`
            );
            if (scanRes) results.push(scanRes);
          }
        }
      }
    }
  }

  // 2. IRON BUTTERFLY (Neutral / Safe Hedged)
  else if (typeUpper === "IRON BUTTERFLY") {
    const shortPut = getLegHelper(atmStrike, 'P', 'SELL');
    const shortCall = getLegHelper(atmStrike, 'C', 'SELL');
    const longPutIdx = atmIdx - wingWidth;
    const longCallIdx = atmIdx + wingWidth;

    if (longPutIdx >= 0 && longCallIdx < strikesList.length) {
      const longPut = getLegHelper(strikesList[longPutIdx], 'P', 'BUY');
      const longCall = getLegHelper(strikesList[longCallIdx], 'C', 'BUY');

      if (shortPut && shortCall && longPut && longCall) {
        const scanRes = buildScanResult(
          `Iron Butterfly (${strikesList[longPutIdx]}/${atmStrike}/${strikesList[longCallIdx]})`,
          [longPut, shortPut, shortCall, longCall],
          `Sell ATM Put/Call at ${atmStrike}, hedged with wings at ${strikesList[longPutIdx]} and ${strikesList[longCallIdx]}.`
        );
        if (scanRes) results.push(scanRes);
      }
    }
  }

  // 3. BULL PUT SPREAD (Bullish / Safe Hedged)
  else if (typeUpper === "BULL PUT SPREAD") {
    for (let sPutOff = minDist; sPutOff <= maxDist; sPutOff += step) {
      const shortPutIdx = atmIdx - sPutOff;
      const longPutIdx = shortPutIdx - wingWidth;

      if (longPutIdx >= 0) {
        const sPut = getLegHelper(strikesList[shortPutIdx], 'P', 'SELL');
        const lPut = getLegHelper(strikesList[longPutIdx], 'P', 'BUY');

        if (sPut && lPut) {
          const scanRes = buildScanResult(
            `Bull Put Spread (${strikesList[longPutIdx]}/${strikesList[shortPutIdx]})`,
            [lPut, sPut],
            `Collect credit by selling Put at ${strikesList[shortPutIdx]}, buying protection at ${strikesList[longPutIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 4. BEAR CALL SPREAD (Bearish / Safe Hedged)
  else if (typeUpper === "BEAR CALL SPREAD") {
    for (let sCallOff = minDist; sCallOff <= maxDist; sCallOff += step) {
      const shortCallIdx = atmIdx + sCallOff;
      const longCallIdx = shortCallIdx + wingWidth;

      if (longCallIdx < strikesList.length) {
        const sCall = getLegHelper(strikesList[shortCallIdx], 'C', 'SELL');
        const lCall = getLegHelper(strikesList[longCallIdx], 'C', 'BUY');

        if (sCall && lCall) {
          const scanRes = buildScanResult(
            `Bear Call Spread (${strikesList[shortCallIdx]}/${strikesList[longCallIdx]})`,
            [sCall, lCall],
            `Collect credit by selling Call at ${strikesList[shortCallIdx]}, buying protection at ${strikesList[longCallIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 5. CALL BUTTERFLY (Neutral / Safe Hedged)
  else if (typeUpper === "CALL BUTTERFLY") {
    const sCallATM = getLegHelper(atmStrike, 'C', 'SELL');
    if (sCallATM) {
      const doubleShortCall = { ...sCallATM, quantity: lotSize * 2 };
      const lowerCallIdx = atmIdx - wingWidth;
      const upperCallIdx = atmIdx + wingWidth;

      if (lowerCallIdx >= 0 && upperCallIdx < strikesList.length) {
        const lCallLower = getLegHelper(strikesList[lowerCallIdx], 'C', 'BUY');
        const lCallUpper = getLegHelper(strikesList[upperCallIdx], 'C', 'BUY');

        if (lCallLower && lCallUpper) {
          const scanRes = buildScanResult(
            `Call Butterfly (${strikesList[lowerCallIdx]}/${atmStrike}/${strikesList[upperCallIdx]})`,
            [lCallLower, doubleShortCall, lCallUpper],
            `Long Call at ${strikesList[lowerCallIdx]}, Short 2x Calls at ${atmStrike}, Long Call at ${strikesList[upperCallIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 6. PUT BUTTERFLY (Neutral / Safe Hedged)
  else if (typeUpper === "PUT BUTTERFLY") {
    const sPutATM = getLegHelper(atmStrike, 'P', 'SELL');
    if (sPutATM) {
      const doubleShortPut = { ...sPutATM, quantity: lotSize * 2 };
      const lowerPutIdx = atmIdx - wingWidth;
      const upperPutIdx = atmIdx + wingWidth;

      if (lowerPutIdx >= 0 && upperPutIdx < strikesList.length) {
        const lPutLower = getLegHelper(strikesList[lowerPutIdx], 'P', 'BUY');
        const lPutUpper = getLegHelper(strikesList[upperPutIdx], 'P', 'BUY');

        if (lPutLower && lPutUpper) {
          const scanRes = buildScanResult(
            `Put Butterfly (${strikesList[lowerPutIdx]}/${atmStrike}/${strikesList[upperPutIdx]})`,
            [lPutLower, doubleShortPut, lPutUpper],
            `Long Put at ${strikesList[lowerPutIdx]}, Short 2x Puts at ${atmStrike}, Long Put at ${strikesList[upperPutIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 7. CALL CONDOR (Neutral / Safe Hedged)
  else if (typeUpper === "CALL CONDOR") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const shortCall1Idx = atmIdx - offset;
      const longCall1Idx = shortCall1Idx - wingWidth;
      const shortCall2Idx = atmIdx + offset;
      const longCall2Idx = shortCall2Idx + wingWidth;

      if (longCall1Idx >= 0 && longCall2Idx < strikesList.length) {
        const lCall1 = getLegHelper(strikesList[longCall1Idx], 'C', 'BUY');
        const sCall1 = getLegHelper(strikesList[shortCall1Idx], 'C', 'SELL');
        const sCall2 = getLegHelper(strikesList[shortCall2Idx], 'C', 'SELL');
        const lCall2 = getLegHelper(strikesList[longCall2Idx], 'C', 'BUY');

        if (lCall1 && sCall1 && sCall2 && lCall2) {
          const scanRes = buildScanResult(
            `Call Condor (${strikesList[longCall1Idx]}/${strikesList[shortCall1Idx]}/${strikesList[shortCall2Idx]}/${strikesList[longCall2Idx]})`,
            [lCall1, sCall1, sCall2, lCall2],
            `Long Call ${strikesList[longCall1Idx]}, Short Call ${strikesList[shortCall1Idx]}, Short Call ${strikesList[shortCall2Idx]}, Long Call ${strikesList[longCall2Idx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 8. PUT CONDOR (Neutral)
  else if (typeUpper === "PUT CONDOR") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const shortPut1Idx = atmIdx - offset;
      const longPut1Idx = shortPut1Idx - wingWidth;
      const shortPut2Idx = atmIdx + offset;
      const longPut2Idx = shortPut2Idx + wingWidth;

      if (longPut1Idx >= 0 && longPut2Idx < strikesList.length) {
        const lPut1 = getLegHelper(strikesList[longPut1Idx], 'P', 'BUY');
        const sPut1 = getLegHelper(strikesList[shortPut1Idx], 'P', 'SELL');
        const sPut2 = getLegHelper(strikesList[shortPut2Idx], 'P', 'SELL');
        const lPut2 = getLegHelper(strikesList[longPut2Idx], 'P', 'BUY');

        if (lPut1 && sPut1 && sPut2 && lPut2) {
          const scanRes = buildScanResult(
            `Put Condor (${strikesList[longPut1Idx]}/${strikesList[shortPut1Idx]}/${strikesList[shortPut2Idx]}/${strikesList[longPut2Idx]})`,
            [lPut1, sPut1, sPut2, lPut2],
            `Long Put ${strikesList[longPut1Idx]}, Short Put ${strikesList[shortPut1Idx]}, Short Put ${strikesList[shortPut2Idx]}, Long Put ${strikesList[longPut2Idx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 9. BULL CALL SPREAD (Bullish)
  else if (typeUpper === "BULL CALL SPREAD") {
    for (let buyOff = 0; buyOff <= Math.min(8, maxDist); buyOff += step) {
      const buyCallIdx = atmIdx + buyOff;
      for (let sCallOff = minDist; sCallOff <= maxDist; sCallOff += step) {
        const sellCallIdx = buyCallIdx + sCallOff;

        if (sellCallIdx < strikesList.length) {
          const lCall = getLegHelper(strikesList[buyCallIdx], 'C', 'BUY');
          const sCall = getLegHelper(strikesList[sellCallIdx], 'C', 'SELL');

          if (lCall && sCall) {
            const scanRes = buildScanResult(
              `Bull Call Spread (${strikesList[buyCallIdx]}/${strikesList[sellCallIdx]})`,
              [lCall, sCall],
              `Long Call at ${strikesList[buyCallIdx]}, Short Call at ${strikesList[sellCallIdx]}.`
            );
            if (scanRes) results.push(scanRes);
          }
        }
      }
    }
  }

  // 10. BEAR PUT SPREAD (Bearish)
  else if (typeUpper === "BEAR PUT SPREAD") {
    for (let buyOff = 0; buyOff <= Math.min(8, maxDist); buyOff += step) {
      const buyPutIdx = atmIdx - buyOff;
      for (let sPutOff = minDist; sPutOff <= maxDist; sPutOff += step) {
        const sellPutIdx = buyPutIdx - sPutOff;

        if (sellPutIdx >= 0) {
          const lPut = getLegHelper(strikesList[buyPutIdx], 'P', 'BUY');
          const sPut = getLegHelper(strikesList[sellPutIdx], 'P', 'SELL');

          if (lPut && sPut) {
            const scanRes = buildScanResult(
              `Bear Put Spread (${strikesList[sellPutIdx]}/${strikesList[buyPutIdx]})`,
              [lPut, sPut],
              `Long Put at ${strikesList[buyPutIdx]}, Short Put at ${strikesList[sellPutIdx]}.`
            );
            if (scanRes) results.push(scanRes);
          }
        }
      }
    }
  }

  // 11. DIR BULL FLY (Bullish Directional Butterfly)
  else if (typeUpper === "DIR BULL FLY") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const centerIdx = atmIdx + offset;
      const lowerIdx = centerIdx - wingWidth;
      const upperIdx = centerIdx + wingWidth;

      if (lowerIdx >= 0 && upperIdx < strikesList.length) {
        const lCallLower = getLegHelper(strikesList[lowerIdx], 'C', 'BUY');
        const sCallCenter = getLegHelper(strikesList[centerIdx], 'C', 'SELL');
        const lCallUpper = getLegHelper(strikesList[upperIdx], 'C', 'BUY');

        if (lCallLower && sCallCenter && lCallUpper) {
          const doubleShort = { ...sCallCenter, quantity: lotSize * 2 };
          const scanRes = buildScanResult(
            `Dir Bull Fly (${strikesList[lowerIdx]}/${strikesList[centerIdx]}/${strikesList[upperIdx]})`,
            [lCallLower, doubleShort, lCallUpper],
            `Bull Butterfly: Long Call ${strikesList[lowerIdx]}, Short 2x Calls at OTM ${strikesList[centerIdx]}, Long Call ${strikesList[upperIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 12. DIR BEAR FLY (Bearish Directional Butterfly)
  else if (typeUpper === "DIR BEAR FLY") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const centerIdx = atmIdx - offset;
      const lowerIdx = centerIdx - wingWidth;
      const upperIdx = centerIdx + wingWidth;

      if (lowerIdx >= 0 && upperIdx < strikesList.length) {
        const lPutLower = getLegHelper(strikesList[lowerIdx], 'P', 'BUY');
        const sPutCenter = getLegHelper(strikesList[centerIdx], 'P', 'SELL');
        const lPutUpper = getLegHelper(strikesList[upperIdx], 'P', 'BUY');

        if (lPutLower && sPutCenter && lPutUpper) {
          const doubleShort = { ...sPutCenter, quantity: lotSize * 2 };
          const scanRes = buildScanResult(
            `Dir Bear Fly (${strikesList[lowerIdx]}/${strikesList[centerIdx]}/${strikesList[upperIdx]})`,
            [lPutLower, doubleShort, lPutUpper],
            `Bear Butterfly: Long Put ${strikesList[lowerIdx]}, Short 2x Puts at OTM ${strikesList[centerIdx]}, Long Put ${strikesList[upperIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 13. BULL CONDOR (Bullish Directional Condor)
  else if (typeUpper === "BULL CONDOR") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const shortCall1Idx = atmIdx + offset;
      const shortCall2Idx = shortCall1Idx + 2;
      const longCall1Idx = shortCall1Idx - wingWidth;
      const longCall2Idx = shortCall2Idx + wingWidth;

      if (longCall1Idx >= 0 && longCall2Idx < strikesList.length) {
        const lCall1 = getLegHelper(strikesList[longCall1Idx], 'C', 'BUY');
        const sCall1 = getLegHelper(strikesList[shortCall1Idx], 'C', 'SELL');
        const sCall2 = getLegHelper(strikesList[shortCall2Idx], 'C', 'SELL');
        const lCall2 = getLegHelper(strikesList[longCall2Idx], 'C', 'BUY');

        if (lCall1 && sCall1 && sCall2 && lCall2) {
          const scanRes = buildScanResult(
            `Bull Condor (${strikesList[longCall1Idx]}/${strikesList[shortCall1Idx]}/${strikesList[shortCall2Idx]}/${strikesList[longCall2Idx]})`,
            [lCall1, sCall1, sCall2, lCall2],
            `Bullish Call Condor: Long Call ${strikesList[longCall1Idx]}, Short Call ${strikesList[shortCall1Idx]}, Short Call ${strikesList[shortCall2Idx]}, Long Call ${strikesList[longCall2Idx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 14. BEAR CONDOR (Bearish Directional Condor)
  else if (typeUpper === "BEAR CONDOR") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const shortPut1Idx = atmIdx - offset;
      const shortPut2Idx = shortPut1Idx - 2;
      const longPut1Idx = shortPut1Idx + wingWidth;
      const longPut2Idx = shortPut2Idx - wingWidth;

      if (longPut2Idx >= 0 && longPut1Idx < strikesList.length) {
        const lPut1 = getLegHelper(strikesList[longPut1Idx], 'P', 'BUY');
        const sPut1 = getLegHelper(strikesList[shortPut1Idx], 'P', 'SELL');
        const sPut2 = getLegHelper(strikesList[shortPut2Idx], 'P', 'SELL');
        const lPut2 = getLegHelper(strikesList[longPut2Idx], 'P', 'BUY');

        if (lPut1 && sPut1 && sPut2 && lPut2) {
          const scanRes = buildScanResult(
            `Bear Condor (${strikesList[longPut2Idx]}/${strikesList[shortPut2Idx]}/${strikesList[shortPut1Idx]}/${strikesList[longPut1Idx]})`,
            [lPut2, sPut2, sPut1, lPut1],
            `Bearish Put Condor: Long Put ${strikesList[longPut2Idx]}, Short Put ${strikesList[shortPut2Idx]}, Short Put ${strikesList[shortPut1Idx]}, Long Put ${strikesList[longPut1Idx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 15. BULL IRON BUTTERFLY (Bullish Directional Iron Butterfly)
  else if (typeUpper === "BULL IRON BUTTERFLY") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const centerIdx = atmIdx + offset;
      const longPutIdx = centerIdx - wingWidth;
      const longCallIdx = centerIdx + wingWidth;

      if (longPutIdx >= 0 && longCallIdx < strikesList.length) {
        const sPut = getLegHelper(strikesList[centerIdx], 'P', 'SELL');
        const sCall = getLegHelper(strikesList[centerIdx], 'C', 'SELL');
        const lPut = getLegHelper(strikesList[longPutIdx], 'P', 'BUY');
        const lCall = getLegHelper(strikesList[longCallIdx], 'C', 'BUY');

        if (sPut && sCall && lPut && lCall) {
          const scanRes = buildScanResult(
            `Bull Iron Butterfly (${strikesList[longPutIdx]}/${strikesList[centerIdx]}/${strikesList[longCallIdx]})`,
            [lPut, sPut, sCall, lCall],
            `Bullish Iron Butterfly centered at OTM ${strikesList[centerIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 16. BEAR IRON BUTTERFLY (Bearish Directional Iron Butterfly)
  else if (typeUpper === "BEAR IRON BUTTERFLY") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const centerIdx = atmIdx - offset;
      const longPutIdx = centerIdx - wingWidth;
      const longCallIdx = centerIdx + wingWidth;

      if (longPutIdx >= 0 && longCallIdx < strikesList.length) {
        const sPut = getLegHelper(strikesList[centerIdx], 'P', 'SELL');
        const sCall = getLegHelper(strikesList[centerIdx], 'C', 'SELL');
        const lPut = getLegHelper(strikesList[longPutIdx], 'P', 'BUY');
        const lCall = getLegHelper(strikesList[longCallIdx], 'C', 'BUY');

        if (sPut && sCall && lPut && lCall) {
          const scanRes = buildScanResult(
            `Bear Iron Butterfly (${strikesList[longPutIdx]}/${centerIdx}/${strikesList[longCallIdx]})`,
            [lPut, sPut, sCall, lCall],
            `Bearish Iron Butterfly centered at OTM ${strikesList[centerIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 17. 1:3:2 CALL RATIO FLY
  else if (typeUpper === "1:3:2 CALL RATIO FLY") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const centerIdx = atmIdx + offset;
      const lowerIdx = centerIdx - 2 * wingWidth;
      const upperIdx = centerIdx + wingWidth;

      if (lowerIdx >= 0 && upperIdx < strikesList.length) {
        const lCallLower = getLegHelper(strikesList[lowerIdx], 'C', 'BUY');
        const sCallCenter = getLegHelper(strikesList[centerIdx], 'C', 'SELL');
        const lCallUpper = getLegHelper(strikesList[upperIdx], 'C', 'BUY');


        if (lCallLower && sCallCenter && lCallUpper) {
          const leg1 = { ...lCallLower, quantity: lotSize };
          const leg2 = { ...sCallCenter, quantity: lotSize * 3 };
          const leg3 = { ...lCallUpper, quantity: lotSize * 2 };
          const scanRes = buildScanResult(
            `1:3:2 Call Ratio Fly (${strikesList[lowerIdx]}/${strikesList[centerIdx]}/${strikesList[upperIdx]})`,
            [leg1, leg2, leg3],
            `Ratio Spread: Long 1x Call at ${strikesList[lowerIdx]}, Short 3x Calls at ${strikesList[centerIdx]}, Long 2x Calls at ${strikesList[upperIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 18. 1:3:2 PUT RATIO FLY
  else if (typeUpper === "1:3:2 PUT RATIO FLY") {
    for (let offset = minDist; offset <= maxDist; offset += step) {
      const centerIdx = atmIdx - offset;
      const lowerIdx = centerIdx - wingWidth;
      const upperIdx = centerIdx + 2 * wingWidth;

      if (lowerIdx >= 0 && upperIdx < strikesList.length) {
        const lPutLower = getLegHelper(strikesList[lowerIdx], 'P', 'BUY');
        const sPutCenter = getLegHelper(strikesList[centerIdx], 'P', 'SELL');
        const lPutUpper = getLegHelper(strikesList[upperIdx], 'P', 'BUY');

        if (lPutLower && sPutCenter && lPutUpper) {
          const leg1 = { ...lPutLower, quantity: lotSize * 2 };
          const leg2 = { ...sPutCenter, quantity: lotSize * 3 };
          const leg3 = { ...lPutUpper, quantity: lotSize };
          const scanRes = buildScanResult(
            `1:3:2 Put Ratio Fly (${strikesList[lowerIdx]}/${strikesList[centerIdx]}/${strikesList[upperIdx]})`,
            [leg3, leg2, leg1],
            `Ratio Spread: Long 2x Puts at ${strikesList[lowerIdx]}, Short 3x Puts at ${strikesList[centerIdx]}, Long 1x Put at ${strikesList[upperIdx]}.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 19. WIDE WING IRON CONDOR
  else if (typeUpper === "WIDE WING IRON CONDOR") {
    for (let sPutOff = minDist; sPutOff <= maxDist; sPutOff += step) {
      for (let sCallOff = minDist; sCallOff <= maxDist; sCallOff += step) {
        const shortPutIdx = atmIdx - sPutOff;
        const longPutIdx = shortPutIdx - (wingWidth + 5);
        const shortCallIdx = atmIdx + sCallOff;
        const longCallIdx = shortCallIdx + (wingWidth + 5);

        if (longPutIdx >= 0 && longCallIdx < strikesList.length) {
          const lPut = getLegHelper(strikesList[longPutIdx], 'P', 'BUY');
          const sPut = getLegHelper(strikesList[shortPutIdx], 'P', 'SELL');
          const sCall = getLegHelper(strikesList[shortCallIdx], 'C', 'SELL');
          const lCall = getLegHelper(strikesList[longCallIdx], 'C', 'BUY');

          if (lPut && sPut && sCall && lCall) {
            const scanRes = buildScanResult(
              `Wide Wing Iron Condor (${strikesList[longPutIdx]}/${strikesList[shortPutIdx]}/${strikesList[shortCallIdx]}/${strikesList[longCallIdx]})`,
              [lPut, sPut, sCall, lCall],
              `Sell Put Spread at ${strikesList[shortPutIdx]} & Sell Call Spread at ${strikesList[shortCallIdx]} with wide wings (+${wingWidth + 5} strikes) for strangle-like decay.`
            );
            if (scanRes) results.push(scanRes);
          }
        }
      }
    }
  }

  // 19b. RATIO IRON CONDOR (1:2)
  else if (typeUpper === "RATIO IRON CONDOR (1:2)") {
    const namePrefix = "Ratio Iron Condor (1:2)";
    for (let sPutOff = minDist; sPutOff <= maxDist; sPutOff += step) {
      for (let sCallOff = minDist; sCallOff <= maxDist; sCallOff += step) {
        const shortPutIdx = atmIdx - sPutOff;
        const longPutIdx = shortPutIdx - wingWidth;
        const shortCallIdx = atmIdx + sCallOff;
        const longCallIdx = shortCallIdx + (wingWidth * 2);

        if (longPutIdx >= 0 && longCallIdx < strikesList.length) {
          const lPut = getLegHelper(strikesList[longPutIdx], 'P', 'BUY');
          const sPut = getLegHelper(strikesList[shortPutIdx], 'P', 'SELL');
          const sCall = getLegHelper(strikesList[shortCallIdx], 'C', 'SELL');
          const lCall = getLegHelper(strikesList[longCallIdx], 'C', 'BUY');

          if (lPut && sPut && sCall && lCall) {
            const lPutQty = { ...lPut, quantity: lotSize * 2 };
            const sPutQty = { ...sPut, quantity: lotSize * 2 };
            const sCallQty = { ...sCall, quantity: lotSize * 1 };
            const lCallQty = { ...lCall, quantity: lotSize * 1 };

            const scanRes = buildScanResult(
              `${namePrefix} (${strikesList[longPutIdx]}/${strikesList[shortPutIdx]}/${strikesList[shortCallIdx]}/${strikesList[longCallIdx]})`,
              [lPutQty, sPutQty, sCallQty, lCallQty],
              `Ratio Condor: 2 Put Spreads (${strikesList[shortPutIdx]}/${strikesList[longPutIdx]}) and 1 Call Spread (${strikesList[shortCallIdx]}/${strikesList[longCallIdx]}) for net credit.`
            );
            if (scanRes) results.push(scanRes);
          }
        }
      }
    }
  }

  // 20. 1:2 PUT RATIO SPREAD
  else if (typeUpper === "1:2 PUT RATIO SPREAD") {
    for (let sPutOff = minDist; sPutOff <= maxDist; sPutOff += step) {
      const buyPutIdx = atmIdx - sPutOff;
      const sellPutIdx = buyPutIdx - wingWidth;

      if (sellPutIdx >= 0) {
        const lPut = getLegHelper(strikesList[buyPutIdx], 'P', 'BUY');
        const sPut = getLegHelper(strikesList[sellPutIdx], 'P', 'SELL');

        if (lPut && sPut) {
          const leg1 = { ...lPut, quantity: lotSize };
          const leg2 = { ...sPut, quantity: lotSize * 2 };

          const scanRes = buildScanResult(
            `1:2 Put Ratio Spread (${strikesList[sellPutIdx]}/${strikesList[buyPutIdx]})`,
            [leg1, leg2],
            `Buy 1x Put at ${strikesList[buyPutIdx]}, Sell 2x Puts at ${strikesList[sellPutIdx]} for credit/neutral bias.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 21. 1:2 CALL RATIO SPREAD
  else if (typeUpper === "1:2 CALL RATIO SPREAD") {
    for (let sCallOff = minDist; sCallOff <= maxDist; sCallOff += step) {
      const buyCallIdx = atmIdx + sCallOff;
      const sellCallIdx = buyCallIdx + wingWidth;

      if (sellCallIdx < strikesList.length) {
        const lCall = getLegHelper(strikesList[buyCallIdx], 'C', 'BUY');
        const sCall = getLegHelper(strikesList[sellCallIdx], 'C', 'SELL');

        if (lCall && sCall) {
          const leg1 = { ...lCall, quantity: lotSize };
          const leg2 = { ...sCall, quantity: lotSize * 2 };

          const scanRes = buildScanResult(
            `1:2 Call Ratio Spread (${strikesList[buyCallIdx]}/${strikesList[sellCallIdx]})`,
            [leg1, leg2],
            `Buy 1x Call at ${strikesList[buyCallIdx]}, Sell 2x Calls at ${strikesList[sellCallIdx]} for credit/neutral bias.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 22. LONG STRADDLE
  else if (typeUpper === "LONG STRADDLE") {
    const lCall = getLegHelper(atmStrike, 'C', 'BUY');
    const lPut = getLegHelper(atmStrike, 'P', 'BUY');
    if (lCall && lPut) {
      const scanRes = buildScanResult(
        `Long Straddle (${atmStrike})`,
        [lCall, lPut],
        `Buy ATM Call & Put at ${atmStrike} expecting large volatility expansion.`
      );
      if (scanRes) results.push(scanRes);
    }
  }

  // 23. SHORT STRADDLE
  else if (typeUpper === "SHORT STRADDLE") {
    const sCall = getLegHelper(atmStrike, 'C', 'SELL');
    const sPut = getLegHelper(atmStrike, 'P', 'SELL');
    if (sCall && sPut) {
      const scanRes = buildScanResult(
        `Short Straddle (${atmStrike})`,
        [sCall, sPut],
        `Sell ATM Call & Put at ${atmStrike} to collect maximum premium and benefit from Theta decay.`
      );
      if (scanRes) results.push(scanRes);
    }
  }

  // 24. LONG STRANGLE
  else if (typeUpper === "LONG STRANGLE") {
    for (let sOff = minDist; sOff <= maxDist; sOff += step) {
      const putIdx = atmIdx - sOff;
      const callIdx = atmIdx + sOff;

      if (putIdx >= 0 && callIdx < strikesList.length) {
        const lPut = getLegHelper(strikesList[putIdx], 'P', 'BUY');
        const lCall = getLegHelper(strikesList[callIdx], 'C', 'BUY');

        if (lPut && lCall) {
          const scanRes = buildScanResult(
            `Long Strangle (${strikesList[putIdx]}/${strikesList[callIdx]})`,
            [lPut, lCall],
            `Buy OTM Put at ${strikesList[putIdx]} & OTM Call at ${strikesList[callIdx]} for cheaper volatility play.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 25. SHORT STRANGLE
  else if (typeUpper === "SHORT STRANGLE") {
    for (let sOff = minDist; sOff <= maxDist; sOff += step) {
      const putIdx = atmIdx - sOff;
      const callIdx = atmIdx + sOff;

      if (putIdx >= 0 && callIdx < strikesList.length) {
        const sPut = getLegHelper(strikesList[putIdx], 'P', 'SELL');
        const sCall = getLegHelper(strikesList[callIdx], 'C', 'SELL');

        if (sPut && sCall) {
          const scanRes = buildScanResult(
            `Short Strangle (${strikesList[putIdx]}/${strikesList[callIdx]})`,
            [sPut, sCall],
            `Sell OTM Put at ${strikesList[putIdx]} & OTM Call at ${strikesList[callIdx]} to collect premium with wider break-evens.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 26. BULL STRADDLE
  else if (typeUpper === "BULL STRADDLE") {
    const targetIdx = atmIdx + wingWidth;
    if (targetIdx < strikesList.length) {
      const targetStrike = strikesList[targetIdx];
      const lCall = getLegHelper(targetStrike, 'C', 'BUY');
      const lPut = getLegHelper(targetStrike, 'P', 'BUY');
      if (lCall && lPut) {
        const scanRes = buildScanResult(
          `Bull Straddle (${targetStrike})`,
          [lCall, lPut],
          `Buy Call & Put at shifted higher strike ${targetStrike} for bullish breakout bias.`
        );
        if (scanRes) results.push(scanRes);
      }
    }
  }

  // 27. BEAR STRADDLE
  else if (typeUpper === "BEAR STRADDLE") {
    const targetIdx = atmIdx - wingWidth;
    if (targetIdx >= 0) {
      const targetStrike = strikesList[targetIdx];
      const lCall = getLegHelper(targetStrike, 'C', 'BUY');
      const lPut = getLegHelper(targetStrike, 'P', 'BUY');
      if (lCall && lPut) {
        const scanRes = buildScanResult(
          `Bear Straddle (${targetStrike})`,
          [lCall, lPut],
          `Buy Call & Put at shifted lower strike ${targetStrike} for bearish breakout bias.`
        );
        if (scanRes) results.push(scanRes);
      }
    }
  }

  // 28. SHORT BULL STRADDLE
  else if (typeUpper === "SHORT BULL STRADDLE") {
    const targetIdx = atmIdx + wingWidth;
    if (targetIdx < strikesList.length) {
      const targetStrike = strikesList[targetIdx];
      const sCall = getLegHelper(targetStrike, 'C', 'SELL');
      const sPut = getLegHelper(targetStrike, 'P', 'SELL');
      if (sCall && sPut) {
        const scanRes = buildScanResult(
          `Short Bull Straddle (${targetStrike})`,
          [sCall, sPut],
          `Sell Call & Put at shifted higher strike ${targetStrike} expecting range-bound consolidation near higher target.`
        );
        if (scanRes) results.push(scanRes);
      }
    }
  }

  // 29. SHORT BEAR STRADDLE
  else if (typeUpper === "SHORT BEAR STRADDLE") {
    const targetIdx = atmIdx - wingWidth;
    if (targetIdx >= 0) {
      const targetStrike = strikesList[targetIdx];
      const sCall = getLegHelper(targetStrike, 'C', 'SELL');
      const sPut = getLegHelper(targetStrike, 'P', 'SELL');
      if (sCall && sPut) {
        const scanRes = buildScanResult(
          `Short Bear Straddle (${targetStrike})`,
          [sCall, sPut],
          `Sell Call & Put at shifted lower strike ${targetStrike} expecting range-bound consolidation near lower target.`
        );
        if (scanRes) results.push(scanRes);
      }
    }
  }

  // 30. BULL STRANGLE
  else if (typeUpper === "BULL STRANGLE") {
    for (let sOff = minDist; sOff <= maxDist; sOff += step) {
      const putIdx = atmIdx - sOff + wingWidth;
      const callIdx = atmIdx + sOff + wingWidth;

      if (putIdx >= 0 && callIdx < strikesList.length && putIdx < callIdx) {
        const lPut = getLegHelper(strikesList[putIdx], 'P', 'BUY');
        const lCall = getLegHelper(strikesList[callIdx], 'C', 'BUY');

        if (lPut && lCall) {
          const scanRes = buildScanResult(
            `Bull Strangle (${strikesList[putIdx]}/${strikesList[callIdx]})`,
            [lPut, lCall],
            `Buy OTM Put at ${strikesList[putIdx]} & Call at ${strikesList[callIdx]} shifted higher for bullish bias.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 31. BEAR STRANGLE
  else if (typeUpper === "BEAR STRANGLE") {
    for (let sOff = minDist; sOff <= maxDist; sOff += step) {
      const putIdx = atmIdx - sOff - wingWidth;
      const callIdx = atmIdx + sOff - wingWidth;

      if (putIdx >= 0 && callIdx < strikesList.length && putIdx < callIdx) {
        const lPut = getLegHelper(strikesList[putIdx], 'P', 'BUY');
        const lCall = getLegHelper(strikesList[callIdx], 'C', 'BUY');

        if (lPut && lCall) {
          const scanRes = buildScanResult(
            `Bear Strangle (${strikesList[putIdx]}/${strikesList[callIdx]})`,
            [lPut, lCall],
            `Buy Put at ${strikesList[putIdx]} & OTM Call at ${strikesList[callIdx]} shifted lower for bearish bias.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 32. SHORT BULL STRANGLE
  else if (typeUpper === "SHORT BULL STRANGLE") {
    for (let sOff = minDist; sOff <= maxDist; sOff += step) {
      const putIdx = atmIdx - sOff + wingWidth;
      const callIdx = atmIdx + sOff + wingWidth;

      if (putIdx >= 0 && callIdx < strikesList.length && putIdx < callIdx) {
        const sPut = getLegHelper(strikesList[putIdx], 'P', 'SELL');
        const sCall = getLegHelper(strikesList[callIdx], 'C', 'SELL');

        if (sPut && sCall) {
          const scanRes = buildScanResult(
            `Short Bull Strangle (${strikesList[putIdx]}/${strikesList[callIdx]})`,
            [sPut, sCall],
            `Sell Put at ${strikesList[putIdx]} & Call at ${strikesList[callIdx]} shifted higher to collect premium with bullish bias.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 33. SHORT BEAR STRANGLE
  else if (typeUpper === "SHORT BEAR STRANGLE") {
    for (let sOff = minDist; sOff <= maxDist; sOff += step) {
      const putIdx = atmIdx - sOff - wingWidth;
      const callIdx = atmIdx + sOff - wingWidth;

      if (putIdx >= 0 && callIdx < strikesList.length && putIdx < callIdx) {
        const sPut = getLegHelper(strikesList[putIdx], 'P', 'SELL');
        const sCall = getLegHelper(strikesList[callIdx], 'C', 'SELL');

        if (sPut && sCall) {
          const scanRes = buildScanResult(
            `Short Bear Strangle (${strikesList[putIdx]}/${strikesList[callIdx]})`,
            [sPut, sCall],
            `Sell Put at ${strikesList[putIdx]} & Call at ${strikesList[callIdx]} shifted lower to collect premium with bearish bias.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 34. COVERED CALL
  else if (typeUpper === "COVERED CALL") {
    // We scan various Call strikes (usually ATM or OTM)
    for (let cOff = 0; cOff <= maxDist; cOff += step) {
      const callIdx = atmIdx + cOff;
      if (callIdx < strikesList.length) {
        const callStrike = strikesList[callIdx];
        const sCall = getLegHelper(callStrike, 'C', 'SELL');

        if (sCall) {
          // Construct the Long Future/Stock leg
          const lFuture: StrategyLeg = {
            id: Math.random().toString(36).substring(2, 9),
            strike: spot,
            optionType: 'F',
            expiry: selectedExpiry,
            action: 'BUY',
            quantity: lotSize,
            entryPrice: spot,
            currentPrice: spot,
            iv: 0
          };

          const scanRes = buildScanResult(
            `Covered Call (${callStrike} CE)`,
            [lFuture, sCall],
            `Long Underlying Stock/Future at ${spot.toFixed(1)} & Sell ${callStrike} Call option to collect premium and cap upside profit.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 35. COVERED PUT
  else if (typeUpper === "COVERED PUT") {
    // We scan various Put strikes (usually ATM or OTM)
    for (let pOff = 0; pOff <= maxDist; pOff += step) {
      const putIdx = atmIdx - pOff;
      if (putIdx >= 0) {
        const putStrike = strikesList[putIdx];
        const sPut = getLegHelper(putStrike, 'P', 'SELL');

        if (sPut) {
          // Construct the Short Future/Stock leg
          const sFuture: StrategyLeg = {
            id: Math.random().toString(36).substring(2, 9),
            strike: spot,
            optionType: 'F',
            expiry: selectedExpiry,
            action: 'SELL',
            quantity: lotSize,
            entryPrice: spot,
            currentPrice: spot,
            iv: 0
          };

          const scanRes = buildScanResult(
            `Covered Put (${putStrike} PE)`,
            [sFuture, sPut],
            `Short Underlying Stock/Future at ${spot.toFixed(1)} & Sell ${putStrike} Put option to collect premium and cap downside profit.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 36. SYNTHETIC LONG
  else if (typeUpper === "SYNTHETIC LONG") {
    for (let offset = -2; offset <= 2; offset++) {
      const strikeIdx = atmIdx + offset;
      if (strikeIdx >= 0 && strikeIdx < strikesList.length) {
        const strike = strikesList[strikeIdx];
        const lCall = getLegHelper(strike, 'C', 'BUY');
        const sPut = getLegHelper(strike, 'P', 'SELL');

        if (lCall && sPut) {
          const scanRes = buildScanResult(
            `Synthetic Long (${strike})`,
            [lCall, sPut],
            `Buy Call & Sell Put at ${strike} to simulate a synthetic long position.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 37. SYNTHETIC SHORT
  else if (typeUpper === "SYNTHETIC SHORT") {
    for (let offset = -2; offset <= 2; offset++) {
      const strikeIdx = atmIdx + offset;
      if (strikeIdx >= 0 && strikeIdx < strikesList.length) {
        const strike = strikesList[strikeIdx];
        const sCall = getLegHelper(strike, 'C', 'SELL');
        const lPut = getLegHelper(strike, 'P', 'BUY');

        if (sCall && lPut) {
          const scanRes = buildScanResult(
            `Synthetic Short (${strike})`,
            [sCall, lPut],
            `Sell Call & Buy Put at ${strike} to simulate a synthetic short position.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 38. SYNTHETIC LONG CALL
  else if (typeUpper === "SYNTHETIC LONG CALL") {
    for (let pOff = 0; pOff <= Math.min(4, maxDist); pOff += step) {
      const putIdx = atmIdx - pOff;
      if (putIdx >= 0) {
        const putStrike = strikesList[putIdx];
        const lPut = getLegHelper(putStrike, 'P', 'BUY');
        if (lPut) {
          const lFuture: StrategyLeg = {
            id: Math.random().toString(36).substring(2, 9),
            strike: spot,
            optionType: 'F',
            expiry: selectedExpiry,
            action: 'BUY',
            quantity: lotSize,
            entryPrice: spot,
            currentPrice: spot,
            iv: 0
          };
          const scanRes = buildScanResult(
            `Synthetic Long Call (${putStrike} Put)`,
            [lFuture, lPut],
            `Long Underlying Stock/Future at ${spot.toFixed(1)} & Buy Put at ${putStrike} to protect the downside, mimicking a Long Call.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 39. SYNTHETIC LONG PUT
  else if (typeUpper === "SYNTHETIC LONG PUT") {
    for (let cOff = 0; cOff <= Math.min(4, maxDist); cOff += step) {
      const callIdx = atmIdx + cOff;
      if (callIdx < strikesList.length) {
        const callStrike = strikesList[callIdx];
        const lCall = getLegHelper(callStrike, 'C', 'BUY');
        if (lCall) {
          const sFuture: StrategyLeg = {
            id: Math.random().toString(36).substring(2, 9),
            strike: spot,
            optionType: 'F',
            expiry: selectedExpiry,
            action: 'SELL',
            quantity: lotSize,
            entryPrice: spot,
            currentPrice: spot,
            iv: 0
          };
          const scanRes = buildScanResult(
            `Synthetic Long Put (${callStrike} Call)`,
            [sFuture, lCall],
            `Short Underlying Stock/Future at ${spot.toFixed(1)} & Buy Call at ${callStrike} to protect the upside, mimicking a Long Put.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 40. PROTECTIVE PUT
  else if (typeUpper === "PROTECTIVE PUT") {
    for (let pOff = 0; pOff <= maxDist; pOff += step) {
      const putIdx = atmIdx - pOff;
      if (putIdx >= 0) {
        const putStrike = strikesList[putIdx];
        const lPut = getLegHelper(putStrike, 'P', 'BUY');
        if (lPut) {
          const lFuture: StrategyLeg = {
            id: Math.random().toString(36).substring(2, 9),
            strike: spot,
            optionType: 'F',
            expiry: selectedExpiry,
            action: 'BUY',
            quantity: lotSize,
            entryPrice: spot,
            currentPrice: spot,
            iv: 0
          };
          const scanRes = buildScanResult(
            `Protective Put (${putStrike} PE)`,
            [lFuture, lPut],
            `Long Underlying Asset at ${spot.toFixed(1)} & Buy OTM ${putStrike} Put option to hedge downside risk.`
          );
          if (scanRes) results.push(scanRes);
        }
      }
    }
  }

  // 41. ZERO COST COLLAR
  else if (typeUpper === "ZERO COST COLLAR") {
    for (let pOff = 1; pOff <= Math.min(5, maxDist); pOff += step) {
      for (let cOff = 1; cOff <= Math.min(5, maxDist); cOff += step) {
        const putIdx = atmIdx - pOff;
        const callIdx = atmIdx + cOff;
        if (putIdx >= 0 && callIdx < strikesList.length) {
          const putStrike = strikesList[putIdx];
          const callStrike = strikesList[callIdx];
          const lPut = getLegHelper(putStrike, 'P', 'BUY');
          const sCall = getLegHelper(callStrike, 'C', 'SELL');
          if (lPut && sCall) {
            const lFuture: StrategyLeg = {
              id: Math.random().toString(36).substring(2, 9),
              strike: spot,
              optionType: 'F',
              expiry: selectedExpiry,
              action: 'BUY',
              quantity: lotSize,
              entryPrice: spot,
              currentPrice: spot,
              iv: 0
            };
            const scanRes = buildScanResult(
              `Zero-Cost Collar (${putStrike} PE / ${callStrike} CE)`,
              [lFuture, lPut, sCall],
              `Long Underlying Asset at ${spot.toFixed(1)}, Buy OTM ${putStrike} Put for downside protection, financed by Selling OTM ${callStrike} Call.`
            );
            if (scanRes) results.push(scanRes);
          }
        }
      }
    }
  }

  // 42. PUT SPREAD COLLAR
  else if (typeUpper === "PUT SPREAD COLLAR") {
    const wing = 2;
    for (let pOff = 1; pOff <= Math.min(4, maxDist); pOff += step) {
      for (let cOff = 1; cOff <= Math.min(4, maxDist); cOff += step) {
        const putIdx1 = atmIdx - pOff;
        const putIdx2 = putIdx1 - wing;
        const callIdx = atmIdx + cOff;
        if (putIdx2 >= 0 && callIdx < strikesList.length) {
          const putStrike1 = strikesList[putIdx1];
          const putStrike2 = strikesList[putIdx2];
          const callStrike = strikesList[callIdx];
          const lPut = getLegHelper(putStrike1, 'P', 'BUY');
          const sPut = getLegHelper(putStrike2, 'P', 'SELL');
          const sCall = getLegHelper(callStrike, 'C', 'SELL');
          if (lPut && sPut && sCall) {
            const lFuture: StrategyLeg = {
              id: Math.random().toString(36).substring(2, 9),
              strike: spot,
              optionType: 'F',
              expiry: selectedExpiry,
              action: 'BUY',
              quantity: lotSize,
              entryPrice: spot,
              currentPrice: spot,
              iv: 0
            };
            const scanRes = buildScanResult(
              `Put Spread Collar (${putStrike2}/${putStrike1} PE / ${callStrike} CE)`,
              [lFuture, lPut, sPut, sCall],
              `Long Underlying Asset at ${spot.toFixed(1)}, buy Put Spread (${putStrike2}/${putStrike1} PE) for protected range, funded by Selling OTM ${callStrike} Call.`
            );
            if (scanRes) results.push(scanRes);
          }
        }
      }
    }
  }

  // Rank scanned results
  const ranked = results.sort((a, b) => {
    const lossA = typeof a.maxLoss === 'number' ? Math.abs(a.maxLoss) : 10000;
    const lossB = typeof b.maxLoss === 'number' ? Math.abs(b.maxLoss) : 10000;
    const scoreA = a.pop * (typeof a.maxProfit === 'number' ? a.maxProfit : 1000) / Math.max(1, lossA);
    const scoreB = b.pop * (typeof b.maxProfit === 'number' ? b.maxProfit : 1000) / Math.max(1, lossB);
    return scoreB - scoreA;
  });

  return ranked.slice(0, 100);
}
