import React, { useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { projectStrategy } from '../utils/optionsMath';
import { ShieldCheck, ShieldAlert, ShieldX, ArrowRight } from 'lucide-react';

export const HedgingAdvisor: React.FC = () => {
  const { legs, underlying } = useStore();

  const spot = underlying?.spot || 0;

  // Calculate strategy metrics
  const analysis = useMemo(() => {
    if (legs.length === 0) return null;
    return projectStrategy(legs, spot, 0, 0, 0.05, underlying?.symbol);
  }, [legs, spot]);

  const metrics = analysis?.metrics;
  const delta = metrics?.delta ?? 0;
  const breakEvens = metrics?.breakEvens ?? [];

  // 1. Delta Neutrality check
  const deltaNeutrality = useMemo(() => {
    if (!analysis) return null;
    const absDelta = Math.abs(delta);
    if (absDelta <= 5.0) {
      return {
        status: "NEUTRAL",
        color: "text-greenBrand border-greenBrand/20 bg-greenBrand/5",
        text: "Position is Delta Neutral. Risk of directional movement is neutralized.",
        advice: "No delta hedging trades needed. Continue monitoring theta decay."
      };
    } else {
      const isLong = delta > 0;
      const hedgeContracts = Math.round(absDelta);
      const instrument = underlying?.symbol ? `${underlying.symbol} Future` : "Asset Futures";

      return {
        status: isLong ? "LONG BIAS" : "SHORT BIAS",
        color: isLong ? "text-cyan-400 border-cyan-400/20 bg-cyan-400/5" : "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
        text: `Directional Bias: ${isLong ? "Bullish (Long)" : "Bearish (Short)"} (Net Delta: ${delta > 0 ? "+" : ""}${delta})`,
        advice: `To neutralize: Sell/Short ${hedgeContracts} contracts of ${instrument}, or Buy ATM ${isLong ? "Puts" : "Calls"} to decrease/increase net delta.`
      };
    }
  }, [analysis, delta, underlying]);

  // 2. Break-even Breach Monitor
  const breachStatus = useMemo(() => {
    if (!analysis) return null;
    if (breakEvens.length === 0) {
      return {
        status: "SAFE",
        color: "text-greenBrand border-greenBrand/20 bg-greenBrand/5",
        icon: ShieldCheck,
        text: "Protected Zone: Spot is within safe bounds.",
        advice: "Theta decay is active. No adjustments required."
      };
    }

    if (breakEvens.length === 1) {
      const be = breakEvens[0];
      const distance = ((spot - be) / spot) * 100;
      const isBullish = projectStrategy(legs, be + 10, 365, 0, 0.05, underlying?.symbol).metrics.maxLoss === 0; // check if profit is above

      if (isBullish) {
        if (spot < be) {
          return {
            status: "BREACHED",
            color: "text-redBrand border-redBrand/20 bg-redBrand/5",
            icon: ShieldX,
            text: `Breached Lower BE: Spot is below ${be.toLocaleString()}`,
            advice: "Roll up Puts to collect credit, or square off to contain losses."
          };
        } else if (distance < 2.0) {
          return {
            status: "WARNING",
            color: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
            icon: ShieldAlert,
            text: `Approaching BE: Spot is close to ${be.toLocaleString()}`,
            advice: "Consider buying ATM protection or establishing a debit spread."
          };
        }
      } else {
        if (spot > be) {
          return {
            status: "BREACHED",
            color: "text-redBrand border-redBrand/20 bg-redBrand/5",
            icon: ShieldX,
            text: `Breached Upper BE: Spot is above ${be.toLocaleString()}`,
            advice: "Roll down Calls to collect credit, or hedge with underlying futures."
          };
        } else if (Math.abs(distance) < 2.0) {
          return {
            status: "WARNING",
            color: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
            icon: ShieldAlert,
            text: `Approaching BE: Spot is close to ${be.toLocaleString()}`,
            advice: "Consider hedging with shares or buying ATM Calls."
          };
        }
      }
    }

    if (breakEvens.length >= 2) {
      const lowerBE = breakEvens[0];
      const upperBE = breakEvens[breakEvens.length - 1];

      if (spot < lowerBE) {
        return {
          status: "BREACHED LOWER",
          color: "text-redBrand border-redBrand/20 bg-redBrand/5",
          icon: ShieldX,
          text: `Breached Lower BE: Spot (${spot.toLocaleString()}) is below ${lowerBE.toLocaleString()}`,
          advice: "Hedging adjustment: Roll down the Short Call leg to collect additional premium, or buy ATM protective Puts."
        };
      } else if (spot > upperBE) {
        return {
          status: "BREACHED UPPER",
          color: "text-redBrand border-redBrand/20 bg-redBrand/5",
          icon: ShieldX,
          text: `Breached Upper BE: Spot (${spot.toLocaleString()}) is above ${upperBE.toLocaleString()}`,
          advice: "Hedging adjustment: Roll up the Short Put leg to collect additional premium, or buy ATM protective Calls."
        };
      }

      // Check if spot is close (within 2%) to the break-evens
      const distLower = ((spot - lowerBE) / spot) * 100;
      const distUpper = ((upperBE - spot) / spot) * 100;

      if (distLower < 2.0) {
        return {
          status: "APPROACHING LOWER",
          color: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
          icon: ShieldAlert,
          text: `Warning: Approaching Lower BE: Spot is ${distLower.toFixed(1)}% away from ${lowerBE.toLocaleString()}`,
          advice: "Consider rolling down the Call spread to lower the upper boundary and defend the position."
        };
      } else if (distUpper < 2.0) {
        return {
          status: "APPROACHING UPPER",
          color: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
          icon: ShieldAlert,
          text: `Warning: Approaching Upper BE: Spot is ${distUpper.toFixed(1)}% away from ${upperBE.toLocaleString()}`,
          advice: "Consider rolling up the Put spread to raise the lower boundary and defend the position."
        };
      }
    }

    return {
      status: "SAFE",
      color: "text-greenBrand border-greenBrand/20 bg-greenBrand/5",
      icon: ShieldCheck,
      text: "Protected Zone: Spot is within break-evens.",
      advice: "Position remains safe. No adjustments needed. Theta decay favors the position."
    };
  }, [analysis, breakEvens, spot, legs]);

  if (legs.length === 0 || !analysis || !deltaNeutrality || !breachStatus) {
    return (
      <div className="bg-cardBg rounded-xl p-4 border border-borderClr/40 text-center text-xs text-gray-500 min-h-[150px] flex items-center justify-center">
        Add strategy legs to enable the Hedging & Adjustments Advisor.
      </div>
    );
  }

  const BreachIcon = breachStatus.icon;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center px-1">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Hedging & Adjustments Advisor</h3>
          <p className="text-[10px] text-gray-500 font-semibold uppercase">Actionable delta neutralization & defense advisory.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Delta Neutrality Card */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[140px] ${deltaNeutrality.color}`}>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold tracking-wider uppercase">Delta Neutrality Monitor</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-gray-950/40 border border-current">
                {deltaNeutrality.status}
              </span>
            </div>
            <p className="text-xs font-bold text-white">{deltaNeutrality.text}</p>
          </div>
          
          <div className="mt-3 text-xs flex gap-2 items-start text-gray-300">
            <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accentCyan" />
            <p className="leading-normal">{deltaNeutrality.advice}</p>
          </div>
        </div>

        {/* Breach / Adjustments Monitor Card */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[140px] ${breachStatus.color}`}>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold tracking-wider uppercase">Boundary Breach Monitor</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-gray-950/40 border border-current flex items-center gap-1">
                <BreachIcon className="w-3 h-3" />
                {breachStatus.status}
              </span>
            </div>
            <p className="text-xs font-bold text-white">{breachStatus.text}</p>
          </div>
          
          <div className="mt-3 text-xs flex gap-2 items-start text-gray-300">
            <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accentCyan" />
            <p className="leading-normal">{breachStatus.advice}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
