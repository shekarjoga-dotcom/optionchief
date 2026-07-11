import React, { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Sparkles } from 'lucide-react';
import type { StrategyLeg } from '../types';

interface Template {
  name: string;
  outlook: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  description: string;
  legsGenerator: (spot: number, step: number, expiry: string, options: any[]) => Omit<StrategyLeg, 'id'>[];
}

// Predefined strategy templates generators
const STRATEGY_TEMPLATES: Template[] = [
  {
    name: "Bull Call Spread",
    outlook: "bullish",
    description: "Buy an ATM Call, sell an OTM Call. Limits profit but lowers entry cost.",
    legsGenerator: (spot, step, expiry, options) => {
      const atm = Math.round(spot / step) * step;
      const otm = atm + step;
      
      const atmCE = options.find(o => o.strike === atm)?.CE;
      const otmCE = options.find(o => o.strike === otm)?.CE;
      
      return [
        { strike: atm, optionType: 'C', expiry, action: 'BUY', quantity: 100, entryPrice: atmCE?.lastPrice || 10.0, currentPrice: atmCE?.lastPrice || 10.0, iv: atmCE?.impliedVolatility || 0.16 },
        { strike: otm, optionType: 'C', expiry, action: 'SELL', quantity: 100, entryPrice: otmCE?.lastPrice || 4.0, currentPrice: otmCE?.lastPrice || 4.0, iv: otmCE?.impliedVolatility || 0.16 }
      ];
    }
  },
  {
    name: "Bear Put Spread",
    outlook: "bearish",
    description: "Buy an ATM Put, sell an OTM Put. Profit from falling prices with lower risk.",
    legsGenerator: (spot, step, expiry, options) => {
      const atm = Math.round(spot / step) * step;
      const otm = atm - step;
      
      const atmPE = options.find(o => o.strike === atm)?.PE;
      const otmPE = options.find(o => o.strike === otm)?.PE;

      return [
        { strike: atm, optionType: 'P', expiry, action: 'BUY', quantity: 100, entryPrice: atmPE?.lastPrice || 10.0, currentPrice: atmPE?.lastPrice || 10.0, iv: atmPE?.impliedVolatility || 0.16 },
        { strike: otm, optionType: 'P', expiry, action: 'SELL', quantity: 100, entryPrice: otmPE?.lastPrice || 4.0, currentPrice: otmPE?.lastPrice || 4.0, iv: otmPE?.impliedVolatility || 0.16 }
      ];
    }
  },
  {
    name: "Iron Condor",
    outlook: "neutral",
    description: "Sell OTM Put Spread and sell OTM Call Spread. Profit from sideways consolidations.",
    legsGenerator: (spot, step, expiry, options) => {
      const atm = Math.round(spot / step) * step;
      const otmCallSell = atm + step * 2;
      const otmCallBuy = otmCallSell + step;
      const otmPutSell = atm - step * 2;
      const otmPutBuy = otmPutSell - step;

      const getOption = (strike: number, type: 'C' | 'P') => {
        const row = options.find(o => o.strike === strike);
        return type === 'C' ? row?.CE : row?.PE;
      };

      return [
        { strike: otmPutBuy, optionType: 'P', expiry, action: 'BUY', quantity: 100, entryPrice: getOption(otmPutBuy, 'P')?.lastPrice || 1.0, currentPrice: getOption(otmPutBuy, 'P')?.lastPrice || 1.0, iv: getOption(otmPutBuy, 'P')?.impliedVolatility || 0.16 },
        { strike: otmPutSell, optionType: 'P', expiry, action: 'SELL', quantity: 100, entryPrice: getOption(otmPutSell, 'P')?.lastPrice || 3.0, currentPrice: getOption(otmPutSell, 'P')?.lastPrice || 3.0, iv: getOption(otmPutSell, 'P')?.impliedVolatility || 0.16 },
        { strike: otmCallSell, optionType: 'C', expiry, action: 'SELL', quantity: 100, entryPrice: getOption(otmCallSell, 'C')?.lastPrice || 3.0, currentPrice: getOption(otmCallSell, 'C')?.lastPrice || 3.0, iv: getOption(otmCallSell, 'C')?.impliedVolatility || 0.16 },
        { strike: otmCallBuy, optionType: 'C', expiry, action: 'BUY', quantity: 100, entryPrice: getOption(otmCallBuy, 'C')?.lastPrice || 1.0, currentPrice: getOption(otmCallBuy, 'C')?.lastPrice || 1.0, iv: getOption(otmCallBuy, 'C')?.impliedVolatility || 0.16 }
      ];
    }
  },
  {
    name: "Long Straddle",
    outlook: "volatile",
    description: "Buy ATM Call and ATM Put. Profit from massive breakouts in either direction.",
    legsGenerator: (spot, step, expiry, options) => {
      const atm = Math.round(spot / step) * step;
      const atmCE = options.find(o => o.strike === atm)?.CE;
      const atmPE = options.find(o => o.strike === atm)?.PE;

      return [
        { strike: atm, optionType: 'C', expiry, action: 'BUY', quantity: 100, entryPrice: atmCE?.lastPrice || 10.0, currentPrice: atmCE?.lastPrice || 10.0, iv: atmCE?.impliedVolatility || 0.16 },
        { strike: atm, optionType: 'P', expiry, action: 'BUY', quantity: 100, entryPrice: atmPE?.lastPrice || 10.0, currentPrice: atmPE?.lastPrice || 10.0, iv: atmPE?.impliedVolatility || 0.16 }
      ];
    }
  },
  {
    name: "Long Strangle",
    outlook: "volatile",
    description: "Buy OTM Call and OTM Put. Cheaper than Straddle but requires larger moves.",
    legsGenerator: (spot, step, expiry, options) => {
      const atm = Math.round(spot / step) * step;
      const callStrike = atm + step;
      const putStrike = atm - step;
      const ce = options.find(o => o.strike === callStrike)?.CE;
      const pe = options.find(o => o.strike === putStrike)?.PE;

      return [
        { strike: callStrike, optionType: 'C', expiry, action: 'BUY', quantity: 100, entryPrice: ce?.lastPrice || 4.0, currentPrice: ce?.lastPrice || 4.0, iv: ce?.impliedVolatility || 0.16 },
        { strike: putStrike, optionType: 'P', expiry, action: 'BUY', quantity: 100, entryPrice: pe?.lastPrice || 4.0, currentPrice: pe?.lastPrice || 4.0, iv: pe?.impliedVolatility || 0.16 }
      ];
    }
  },
  {
    name: "Ratio Call Backspread",
    outlook: "bullish",
    description: "Sell 1 ATM Call, Buy 2 OTM Calls. Profitable on volatile uptrends, protected on downside.",
    legsGenerator: (spot, step, expiry, options) => {
      const atm = Math.round(spot / step) * step;
      const otm = atm + step;
      const ceAtm = options.find(o => o.strike === atm)?.CE;
      const ceOtm = options.find(o => o.strike === otm)?.CE;

      return [
        { strike: atm, optionType: 'C', expiry, action: 'SELL', quantity: 100, entryPrice: ceAtm?.lastPrice || 10.0, currentPrice: ceAtm?.lastPrice || 10.0, iv: ceAtm?.impliedVolatility || 0.16 },
        { strike: otm, optionType: 'C', expiry, action: 'BUY', quantity: 200, entryPrice: ceOtm?.lastPrice || 4.0, currentPrice: ceOtm?.lastPrice || 4.0, iv: ceOtm?.impliedVolatility || 0.16 }
      ];
    }
  },
  {
    name: "Delta-Neutral Strangle",
    outlook: "neutral",
    description: "Sell 1 OTM Call and 1 OTM Put. Delta-neutral entry, maximizing theta collection.",
    legsGenerator: (spot, step, expiry, options) => {
      const atm = Math.round(spot / step) * step;
      const callStrike = atm + step * 2;
      const putStrike = atm - step * 2;
      const ce = options.find(o => o.strike === callStrike)?.CE;
      const pe = options.find(o => o.strike === putStrike)?.PE;

      return [
        { strike: callStrike, optionType: 'C', expiry, action: 'SELL', quantity: 100, entryPrice: ce?.lastPrice || 3.0, currentPrice: ce?.lastPrice || 3.0, iv: ce?.impliedVolatility || 0.16 },
        { strike: putStrike, optionType: 'P', expiry, action: 'SELL', quantity: 100, entryPrice: pe?.lastPrice || 3.0, currentPrice: pe?.lastPrice || 3.0, iv: pe?.impliedVolatility || 0.16 }
      ];
    }
  }
];

export const Screener: React.FC = () => {
  const { underlying, options, selectedExpiry, clearLegs, addLeg } = useStore();
  const [filter, setFilter] = useState<'all' | 'bullish' | 'bearish' | 'neutral' | 'volatile'>('all');

  const spot = underlying?.spot || 0;

  // Deduce strike step size
  const strikeStep = (() => {
    if (options.length < 2) return 50;
    return Math.abs(options[0].strike - options[1].strike) || 50;
  })();

  const handleApplyTemplate = (template: Template) => {
    if (options.length === 0 || !selectedExpiry) {
      alert("Option chain not loaded. Cannot generate strategy legs.");
      return;
    }
    
    // Clear old strategy legs
    clearLegs();
    
    // Generate new ones
    const newLegs = template.legsGenerator(spot, strikeStep, selectedExpiry, options);
    
    // Add to store
    newLegs.forEach((leg) => {
      addLeg(leg);
    });

    alert(`Applied ${template.name}! View the Payoff tab to analyze.`);
  };

  const filteredTemplates = STRATEGY_TEMPLATES.filter(
    (t) => filter === 'all' || t.outlook === filter
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Wizard Settings */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Strategy Wizard</h3>
          <p className="text-[10px] text-gray-500">Pick predefined strategies matching your market outlook.</p>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-4 flex flex-col gap-4">
        {/* Outlook filters */}
        <div className="flex flex-wrap gap-2 items-center border-b border-borderClr/30 pb-3">
          <span className="text-xs text-gray-400 font-semibold mr-2">Market Outlook:</span>
          {(['all', 'bullish', 'bearish', 'neutral', 'volatile'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all border ${
                filter === mode
                  ? "bg-accentBrand border-accentBrand text-white"
                  : "bg-gray-950 border-borderClr/60 text-gray-400 hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => {
            let color = "border-gray-800 hover:border-gray-700";
            let tagColor = "text-gray-400 bg-gray-900";
            if (template.outlook === 'bullish') {
              color = "border-greenBrand/20 hover:border-greenBrand/40";
              tagColor = "text-greenBrand bg-greenBrand/10";
            } else if (template.outlook === 'bearish') {
              color = "border-redBrand/20 hover:border-redBrand/40";
              tagColor = "text-redBrand bg-redBrand/10";
            } else if (template.outlook === 'neutral') {
              color = "border-cyan-500/20 hover:border-cyan-500/40";
              tagColor = "text-cyan-400 bg-cyan-400/10";
            } else if (template.outlook === 'volatile') {
              color = "border-yellow-500/20 hover:border-yellow-500/40";
              tagColor = "text-yellow-400 bg-yellow-400/10";
            }

            return (
              <div
                key={template.name}
                className={`flex flex-col justify-between p-4 rounded-xl bg-cardBg border transition-all ${color}`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accentCyan" />
                      {template.name}
                    </h4>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${tagColor}`}>
                      {template.outlook}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed min-h-[40px]">{template.description}</p>
                </div>

                <button
                  onClick={() => handleApplyTemplate(template)}
                  className="mt-4 w-full py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-xs font-bold text-white border border-borderClr/60 hover:border-gray-500 transition-all"
                >
                  Generate Legs
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
