import React, { useState } from 'react';
import { 
  CheckCircle2 
} from 'lucide-react';

interface StrategyDetail {
  id: string;
  name: string;
  category: 'bullish' | 'bearish' | 'neutral' | 'ratio';
  summary: string;
  marketView: string;
  legs: { action: 'BUY' | 'SELL'; type: 'CE' | 'PE'; strikeOffset: string; delta: string }[];
  maxProfit: string;
  maxLoss: string;
  breakevens: string;
  thetaImpact: string;
  vegaImpact: string;
  marginRelief: string;
  numericalExample: {
    spot: string;
    strikes: string;
    netPremium: string;
    maxGain: string;
    maxRisk: string;
  };
  scenarios: { move: string; spotPrice: string; pnl: string; status: 'profit' | 'loss' | 'neutral' }[];
  howToBuild: string[];
}

const STRATEGIES: StrategyDetail[] = [
  {
    id: 'iron-condor',
    name: 'Iron Condor (4-Leg Defined Risk)',
    category: 'neutral',
    summary: 'A 4-leg range-bound strategy composed of an OTM Bear Call Spread and an OTM Bull Put Spread. Designed to harvest daily Theta decay with zero upside or downside uncapped tail risk.',
    marketView: 'Range-Bound / Low Volatility. Expects the underlying index to consolidate inside a wide price corridor until expiration.',
    legs: [
      { action: 'BUY', type: 'PE', strikeOffset: 'Lower Wing (e.g. 24,600)', delta: '-0.10' },
      { action: 'SELL', type: 'PE', strikeOffset: 'Short Put (e.g. 24,800)', delta: '-0.20' },
      { action: 'SELL', type: 'CE', strikeOffset: 'Short Call (e.g. 25,200)', delta: '+0.20' },
      { action: 'BUY', type: 'CE', strikeOffset: 'Upper Wing (e.g. 25,400)', delta: '+0.10' }
    ],
    maxProfit: 'Net Credit Collected upfront (e.g. ₹65 per share = ₹3,250 / lot)',
    maxLoss: 'Wing Width - Net Credit (e.g. ₹200 - ₹65 = ₹135 per share = ₹6,750 / lot)',
    breakevens: 'Lower: Short Put - Net Credit (24,735) | Upper: Short Call + Net Credit (25,265)',
    thetaImpact: 'Strongly Positive (+Θ). Earns premium every single calendar day market stays in range.',
    vegaImpact: 'Negative (-ν). Profits when Implied Volatility drops (IV Crush).',
    marginRelief: 'High relief. Exchange margin reduced by ~65% compared to naked strangle due to defined wings.',
    numericalExample: {
      spot: 'NIFTY at 25,000',
      strikes: '24600P / 24800P / 25200C / 25400C',
      netPremium: '+₹65 Credit',
      maxGain: '+₹3,250 (Full Profit)',
      maxRisk: '-₹6,750 (Capped Loss)'
    },
    scenarios: [
      { move: '+2.0% Rally', spotPrice: '25,500', pnl: '-₹6,750 (Max Loss hit on Call wing)', status: 'loss' },
      { move: '+0.5% Drift', spotPrice: '25,125', pnl: '+₹3,250 (Full Profit inside sweetspot)', status: 'profit' },
      { move: '0.0% Flat', spotPrice: '25,000', pnl: '+₹3,250 (Full Profit inside sweetspot)', status: 'profit' },
      { move: '-0.5% Drift', spotPrice: '24,875', pnl: '+₹3,250 (Full Profit inside sweetspot)', status: 'profit' },
      { move: '-2.0% Drop', spotPrice: '24,500', pnl: '-₹6,750 (Max Loss hit on Put wing)', status: 'loss' }
    ],
    howToBuild: [
      'In Strategy Analyzer, select template "Iron Condor".',
      'OptionChief auto-populates 4 legs around 20-Delta short strikes.',
      'Adjust wing widths (e.g. 200 points) to match your risk budget.',
      'Verify Net Credit > 1/3rd of wing width and POP >= 70%.'
    ]
  },
  {
    id: 'ratio-fly',
    name: '1:3:2 Ratio Spread (Quantitative Regime Fly)',
    category: 'ratio',
    summary: 'An institutional asymmetrical structure (Buy 1 ATM, Sell 3 OTM, Buy 2 Far OTM). Creates an enormous profit apex with zero downside loss risk and defined upside protection.',
    marketView: 'Mildly Bullish to Range-Bound. Profits from moderate directional drift with high positive Theta and volatility decay.',
    legs: [
      { action: 'BUY', type: 'CE', strikeOffset: 'Lower Leg (1x @ 25,000)', delta: '+0.50' },
      { action: 'SELL', type: 'CE', strikeOffset: 'Body Apex (3x @ 25,200)', delta: '+0.25' },
      { action: 'BUY', type: 'CE', strikeOffset: 'Upper Wing (2x @ 25,400)', delta: '+0.10' }
    ],
    maxProfit: 'Massive peak at Short Apex Strike (e.g. +₹12,800 on 1 lot)',
    maxLoss: 'Zero loss on downside; strictly capped loss on runaway rally.',
    breakevens: 'Wide multi-thousand point range.',
    thetaImpact: 'Highly Positive (+Θ) near the apex strikes.',
    vegaImpact: 'Negative (-ν) benefit from volatility contraction.',
    marginRelief: 'Optimized margin structure due to 2x far OTM hedges.',
    numericalExample: {
      spot: 'NIFTY at 25,000',
      strikes: '1x 25000C / 3x 25200C / 2x 25400C',
      netPremium: 'Net ₹0 / Zero Cost',
      maxGain: '+₹14,500 (At 25,200 Pin)',
      maxRisk: '-₹2,200 (Above 25,400)'
    },
    scenarios: [
      { move: '+2.0% Rally', spotPrice: '25,500', pnl: '-₹2,200 (Defined small loss on runaway)', status: 'loss' },
      { move: '+0.8% Target', spotPrice: '25,200', pnl: '+₹14,500 (Massive peak profit)', status: 'profit' },
      { move: '0.0% Flat', spotPrice: '25,000', pnl: '₹0 (Zero Loss entry)', status: 'neutral' },
      { move: '-1.0% Drop', spotPrice: '24,750', pnl: '₹0 (Zero Loss on market drops)', status: 'neutral' },
      { move: '-3.0% Crash', spotPrice: '24,250', pnl: '₹0 (Zero Loss protection)', status: 'neutral' }
    ],
    howToBuild: [
      'In Strategy Screener, filter by "1:3:2 Ratio Spread".',
      'Or in Leg Manager, add 3 Call legs with ratios 1 : 3 : 2.',
      'Check that net debit is close to ₹0 for zero downside risk.'
    ]
  },
  {
    id: 'bull-call-spread',
    name: 'Bull Call Spread (Debit Spread)',
    category: 'bullish',
    summary: 'A defined-risk bullish strategy combining a Long ATM Call with a Short OTM Call to reduce entry cost and hedge against IV drop.',
    marketView: 'Moderately Bullish. Expects the underlying asset to rise steadily up to the short strike.',
    legs: [
      { action: 'BUY', type: 'CE', strikeOffset: 'ATM Call (e.g. 25,000)', delta: '+0.50' },
      { action: 'SELL', type: 'CE', strikeOffset: 'OTM Call (e.g. 25,300)', delta: '+0.25' }
    ],
    maxProfit: 'Strike Width - Net Debit Paid (e.g. 300 - 110 = ₹190 = +₹9,500 / lot)',
    maxLoss: 'Net Debit Paid (e.g. ₹110 = -₹5,500 / lot)',
    breakevens: 'Lower Strike + Net Debit (25,110)',
    thetaImpact: 'Mildly negative to neutral depending on spot position.',
    vegaImpact: 'Mildly positive; much lower volatility drag than naked Long Call.',
    marginRelief: 'No margin requirement (pure debit paid).',
    numericalExample: {
      spot: 'NIFTY at 25,000',
      strikes: 'Buy 25000 CE / Sell 25300 CE',
      netPremium: '-₹110 Debit Paid',
      maxGain: '+₹9,500 (+172%)',
      maxRisk: '-₹5,500 (100% of debit)'
    },
    scenarios: [
      { move: '+2.0% Rally', spotPrice: '25,500', pnl: '+₹9,500 (Max Profit achieved)', status: 'profit' },
      { move: '+1.0% Rise', spotPrice: '25,250', pnl: '+₹7,000', status: 'profit' },
      { move: '0.0% Flat', spotPrice: '25,000', pnl: '-₹5,500 (Total debit lost if below 25,000)', status: 'loss' },
      { move: '-1.0% Drop', spotPrice: '24,750', pnl: '-₹5,500', status: 'loss' }
    ],
    howToBuild: [
      'In Leg Manager, choose "Bull Call Spread" template.',
      'Select ATM Strike to Buy and 200-300 points OTM Strike to Sell.',
      'Inspect payoff curve and ensure risk/reward is at least 1 : 1.5.'
    ]
  },
  {
    id: 'bear-put-spread',
    name: 'Bear Put Spread (Debit Spread)',
    category: 'bearish',
    summary: 'A defined-risk bearish strategy combining a Long ATM Put with a Short OTM Put to profit from market declines at a fraction of naked Put cost.',
    marketView: 'Moderately Bearish. Expects the underlying asset to decline toward the short strike.',
    legs: [
      { action: 'BUY', type: 'PE', strikeOffset: 'ATM Put (e.g. 25,000)', delta: '-0.50' },
      { action: 'SELL', type: 'PE', strikeOffset: 'OTM Put (e.g. 24,700)', delta: '-0.25' }
    ],
    maxProfit: 'Strike Width - Net Debit Paid (e.g. 300 - 105 = ₹195 = +₹9,750 / lot)',
    maxLoss: 'Net Debit Paid (e.g. ₹105 = -₹5,250 / lot)',
    breakevens: 'Upper Strike - Net Debit (24,895)',
    thetaImpact: 'Mildly negative; protected by short put decay.',
    vegaImpact: 'Mildly positive.',
    marginRelief: 'No margin required (pure debit).',
    numericalExample: {
      spot: 'NIFTY at 25,000',
      strikes: 'Buy 25000 PE / Sell 24700 PE',
      netPremium: '-₹105 Debit Paid',
      maxGain: '+₹9,750 (+185%)',
      maxRisk: '-₹5,250 (100% of debit)'
    },
    scenarios: [
      { move: '-2.0% Crash', spotPrice: '24,500', pnl: '+₹9,750 (Max Profit achieved)', status: 'profit' },
      { move: '-1.0% Drop', spotPrice: '24,750', pnl: '+₹7,250', status: 'profit' },
      { move: '0.0% Flat', spotPrice: '25,000', pnl: '-₹5,250 (Debit lost if above 25,000)', status: 'loss' },
      { move: '+1.0% Rise', spotPrice: '25,250', pnl: '-₹5,250', status: 'loss' }
    ],
    howToBuild: [
      'In Leg Manager, choose "Bear Put Spread" template.',
      'Select ATM Strike to Buy and lower OTM strike to Sell.',
      'Review breakeven and max risk in Payoff Chart.'
    ]
  }
];

export const HelpStrategyLibrary: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDetail>(STRATEGIES[0]);
  const [filterCategory, setFilterCategory] = useState<'all' | 'neutral' | 'ratio' | 'bullish' | 'bearish'>('all');

  const filteredStrategies = STRATEGIES.filter(s => filterCategory === 'all' || s.category === filterCategory);

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-1 border-b border-borderClr/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-500/15 text-purple-300 border border-purple-500/30">
            Strategy Encyclopedia
          </span>
          <h2 className="text-lg md:text-xl font-extrabold text-white">
            Visual Options Strategy Library & Payoff Blueprints
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Standardized institutional strategy profiles with exact OptionChief build instructions, scenario tables, and Greeks impact.
        </p>
      </div>

      {/* Strategy Category Filter */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All Strategies' },
          { id: 'neutral', label: 'Range-Bound (Iron Condor)' },
          { id: 'ratio', label: 'Quantitative (1:3:2 Ratio Fly)' },
          { id: 'bullish', label: 'Bullish (Call Spreads)' },
          { id: 'bearish', label: 'Bearish (Put Spreads)' }
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterCategory(c.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border ${
              filterCategory === c.id
                ? 'bg-accentBrand text-white border-accentBrand shadow-md'
                : 'bg-gray-950/60 text-gray-400 border-borderClr/30 hover:text-gray-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Strategies Horizontal Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredStrategies.map((strat) => {
          const isSelected = selectedStrategy.id === strat.id;
          return (
            <div
              key={strat.id}
              onClick={() => setSelectedStrategy(strat)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                isSelected
                  ? 'bg-accentBrand/15 border-accentBrand shadow-lg shadow-accentBrand/15 scale-[1.02]'
                  : 'bg-gray-950/40 border-borderClr/30 hover:border-gray-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                    strat.category === 'neutral' ? 'bg-purple-500/20 text-purple-300' :
                    strat.category === 'ratio' ? 'bg-amber-500/20 text-amber-300' :
                    strat.category === 'bullish' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {strat.category}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">{strat.legs.length} Legs</span>
                </div>
                <h4 className="text-xs font-extrabold text-white">{strat.name}</h4>
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                {strat.summary}
              </p>
            </div>
          );
        })}
      </div>

      {/* Selected Strategy Deep-Dive Blueprint */}
      <div className="glass-panel p-6 md:p-8 rounded-2xl border border-borderClr/40 bg-gradient-to-b from-gray-950 via-slate-950 to-gray-950 flex flex-col gap-6 shadow-2xl">
        
        {/* Strategy Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-borderClr/30 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg md:text-xl font-extrabold text-white">
                {selectedStrategy.name}
              </h3>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-accentCyan/15 text-accentCyan border border-accentCyan/30">
                {selectedStrategy.category}
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
              {selectedStrategy.summary}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-950 border border-borderClr/40 text-xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Market View</span>
            <span className="text-emerald-400 font-bold">{selectedStrategy.marketView}</span>
          </div>
        </div>

        {/* Legs Structure & Numerical Example */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Multi-Leg Architecture ({selectedStrategy.legs.length} Legs)
            </span>
            <div className="space-y-2">
              {selectedStrategy.legs.map((leg, i) => (
                <div key={i} className="p-3 rounded-xl bg-gray-950/80 border border-borderClr/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                      leg.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}>
                      {leg.action}
                    </span>
                    <span className="font-bold text-white">{leg.strikeOffset}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400">
                    <span>Type: {leg.type}</span>
                    <span>Δ: {leg.delta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Key Payoff Telemetry
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-gray-950 border border-borderClr/30">
                <span className="text-[10px] text-gray-400 uppercase block">Max Profit</span>
                <span className="text-emerald-400 font-bold text-xs">{selectedStrategy.maxProfit}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-950 border border-borderClr/30">
                <span className="text-[10px] text-gray-400 uppercase block">Max Loss</span>
                <span className="text-red-400 font-bold text-xs">{selectedStrategy.maxLoss}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-950 border border-borderClr/30">
                <span className="text-[10px] text-gray-400 uppercase block">Theta (Time Decay)</span>
                <span className="text-cyan-300 font-bold text-xs">{selectedStrategy.thetaImpact}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-950 border border-borderClr/30">
                <span className="text-[10px] text-gray-400 uppercase block">Margin Relief</span>
                <span className="text-purple-300 font-bold text-xs">{selectedStrategy.marginRelief}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Spot Shift Scenario Table (+2% to -2%) */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-white uppercase tracking-wider block">
            Spot Price Movement Scenarios (Underlying Drift Analysis)
          </span>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-[10px] uppercase text-gray-400 bg-gray-900/60 border-b border-borderClr/30">
                  <th className="py-2.5 px-3">Market Shift</th>
                  <th className="py-2.5 px-3">Simulated Spot</th>
                  <th className="py-2.5 px-3">Estimated Expiry Outcome</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderClr/15 text-[11px]">
                {selectedStrategy.scenarios.map((sc, i) => (
                  <tr key={i} className="hover:bg-gray-900/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white">{sc.move}</td>
                    <td className="py-2.5 px-3 text-cyan-300">{sc.spotPrice}</td>
                    <td className="py-2.5 px-3 text-gray-300">{sc.pnl}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        sc.status === 'profit' ? 'bg-emerald-500/20 text-emerald-300' :
                        sc.status === 'loss' ? 'bg-red-500/20 text-red-300' : 'bg-gray-800 text-gray-300'
                      }`}>
                        {sc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* How to Build in OptionChief Step List */}
        <div className="p-4 rounded-xl bg-gray-950 border border-borderClr/40 space-y-2 text-xs">
          <span className="text-[10px] font-bold text-accentCyan uppercase tracking-wider block">
            How to Build this Strategy in OptionChief:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {selectedStrategy.howToBuild.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 text-gray-300 text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-accentCyan shrink-0 mt-0.5" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
