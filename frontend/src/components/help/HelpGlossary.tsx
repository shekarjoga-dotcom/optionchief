import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

interface GlossaryEntry {
  term: string;
  oneLine: string;
  explanation: string;
  example: string;
  locationInOptionChief: string;
  category: 'Core' | 'Greeks' | 'Metrics' | 'Strategies';
}

const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    term: 'ATM (At-The-Money)',
    oneLine: 'An option whose strike price is equal or closest to the current market spot price.',
    explanation: 'ATM options contain the highest extrinsic time value and the highest Gamma sensitivity. Their Delta is approximately 0.50 for Calls and -0.50 for Puts.',
    example: 'When NIFTY spot is 25,020, the 25,000 Call and 25,000 Put are ATM.',
    locationInOptionChief: 'Highlighted with yellow marker in Option Chain Table.',
    category: 'Core'
  },
  {
    term: 'ITM (In-The-Money)',
    oneLine: 'An option that has intrinsic cash value if exercised immediately.',
    explanation: 'Call strikes below current spot, and Put strikes above current spot. These contracts carry high Delta (> 0.50 to 1.00) and track underlying moves closely.',
    example: '24,800 Call when NIFTY is 25,000 has ₹200 Intrinsic Value.',
    locationInOptionChief: 'Shaded with tinted background in Option Chain.',
    category: 'Core'
  },
  {
    term: 'OTM (Out-Of-The-Money)',
    oneLine: 'An option with zero intrinsic value, composed entirely of time decay value.',
    explanation: 'Call strikes above spot, and Put strikes below spot. Cheaper to buy, but expire completely worthless (₹0) if spot does not cross the strike before expiry.',
    example: '25,400 Call when NIFTY is 25,000 has ₹0 Intrinsic Value.',
    locationInOptionChief: 'Outer strike rows in Option Chain.',
    category: 'Core'
  },
  {
    term: 'Delta (Δ)',
    oneLine: 'Measures expected change in option price per ₹1 move in underlying asset.',
    explanation: 'Call Delta is positive (0 to +1.00); Put Delta is negative (-1.00 to 0). Also represents approximate probability of expiring In-The-Money.',
    example: 'Delta = 0.40 means option price increases by ₹40 on a ₹100 index rise.',
    locationInOptionChief: 'Greeks column in Option Chain & Net Delta in Payoff Lab.',
    category: 'Greeks'
  },
  {
    term: 'Gamma (Γ)',
    oneLine: 'The rate of change of Delta per ₹1 move in spot price (Delta acceleration).',
    explanation: 'Highest for ATM options near expiration (Pin Risk). High Gamma can turn a Delta-neutral strategy directional very quickly.',
    example: 'Gamma = 0.004 means a ₹10 spot jump increases Delta from 0.50 to 0.54.',
    locationInOptionChief: 'Greeks column in Option Chain & Payoff Greek Telemetry.',
    category: 'Greeks'
  },
  {
    term: 'Theta (Θ)',
    oneLine: 'The daily dollar/rupee rate of time decay in an option contract.',
    explanation: 'Options lose value every calendar day as expiration approaches. Option sellers harvest positive Theta; option buyers pay Theta decay.',
    example: 'Theta = -₹18.00 means the contract loses ₹18 value each 24 hours.',
    locationInOptionChief: 'Greeks column in Option Chain & Strategy Daily Theta harvest.',
    category: 'Greeks'
  },
  {
    term: 'Vega (ν)',
    oneLine: 'Sensitivity of option premium to a 1% change in Implied Volatility (IV).',
    explanation: 'Options increase in value when IV rises (volatility spike) and collapse in value when IV drops (IV Crush post-earnings/budget).',
    example: 'Vega = ₹12.50 means a 2% IV increase adds ₹25 to the contract price.',
    locationInOptionChief: 'Payoff Lab IV Offset Simulation Slider.',
    category: 'Greeks'
  },
  {
    term: 'Implied Volatility (IV %)',
    oneLine: 'Market-forecasted annualized volatility priced into option premiums.',
    explanation: 'Higher IV implies expected wide swings (expensive options); lower IV implies calm consolidation (cheap options).',
    example: 'NIFTY IV = 13.5% vs BankNifty IV = 16.2%.',
    locationInOptionChief: 'IV Column in Option Chain & Volatility Cone Tab.',
    category: 'Metrics'
  },
  {
    term: 'PCR (Put-Call Ratio)',
    oneLine: 'Total Put Open Interest divided by Total Call Open Interest.',
    explanation: 'Institutional sentiment metric. PCR > 1.20 is Bullish (Put writing); PCR < 0.70 is Bearish (Call writing); 0.90 - 1.10 is Neutral.',
    example: 'PCR = 1.28 indicates strong Put writing support.',
    locationInOptionChief: 'Option Chain Top Header Banner.',
    category: 'Metrics'
  },
  {
    term: 'Max Pain Strike',
    oneLine: 'The strike price where option buyers experience maximum financial loss at expiry.',
    explanation: 'Market maker delta hedging frequently pulls underlying index spot prices toward the Max Pain strike during contract expiry afternoon.',
    example: 'Max Pain = 25,000 Strike.',
    locationInOptionChief: 'Option Chain Top Header Banner.',
    category: 'Metrics'
  },
  {
    term: '1:3:2 Ratio Spread',
    oneLine: 'Quantitative asymmetric multi-leg structure (Buy 1, Sell 3, Buy 2).',
    explanation: 'Designed to profit from implied volatility skew and drift with massive upside apex profit and zero downside loss.',
    example: 'Buy 1x 25,000 CE / Sell 3x 25,200 CE / Buy 2x 25,400 CE.',
    locationInOptionChief: 'Strategy Screener & Strategy Analyzer Tab.',
    category: 'Strategies'
  },
  {
    term: 'Iron Condor',
    oneLine: '4-leg defined-risk range-bound strategy (1 OTM Bull Put + 1 OTM Bear Call).',
    explanation: 'Collects net credit upfront with strictly capped risk on outer wings. Best deployed when IV is elevated and market is consolidating.',
    example: '24600P / 24800P / 25200C / 25400C.',
    locationInOptionChief: 'Strategy Screener & Leg Manager Template.',
    category: 'Strategies'
  },
  {
    term: 'Probability of Profit (POP %)',
    oneLine: 'The statistical probability that a strategy will close with at least ₹1 profit at expiry.',
    explanation: 'Calculated using Black-Scholes lognormal distribution based on strike distance, implied volatility, and days to expiry.',
    example: 'POP = 74.2% on 20-Delta Iron Condor.',
    locationInOptionChief: 'Strategy Screener & Alerts Panel.',
    category: 'Metrics'
  },
  {
    term: 'Days to Expiry (DTE)',
    oneLine: 'The exact calendar days remaining until the option contract expires and settles.',
    explanation: 'Theta decay accelerates exponentially when DTE is under 10 days.',
    example: '7 DTE for current weekly contract.',
    locationInOptionChief: 'Expiry Selector Bar & Payoff DTE Slider.',
    category: 'Core'
  }
];

export const HelpGlossary: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Core' | 'Greeks' | 'Metrics' | 'Strategies'>('All');

  const filteredEntries = useMemo(() => {
    return GLOSSARY_ENTRIES.filter((e) => {
      const matchCat = selectedCategory === 'All' || e.category === selectedCategory;
      const query = searchTerm.toLowerCase().trim();
      const matchQuery = query === '' || 
        e.term.toLowerCase().includes(query) || 
        e.oneLine.toLowerCase().includes(query) || 
        e.explanation.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-1 border-b border-borderClr/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
            A-Z Reference
          </span>
          <h2 className="text-lg md:text-xl font-extrabold text-white">
            Options & Quantitative Glossary
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Search and review definitions, mathematical formulas, and real OptionChief examples.
        </p>
      </div>

      {/* Search & Category Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search glossary terms (e.g. Delta, Max Pain, Ratio Fly, IV)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-borderClr rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accentBrand"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {['All', 'Core', 'Greeks', 'Metrics', 'Strategies'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? 'bg-accentBrand text-white border-accentBrand shadow-md'
                  : 'bg-gray-950 text-gray-400 border-borderClr/30 hover:text-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Glossary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEntries.map((entry, idx) => (
          <div
            key={idx}
            className="glass-panel p-5 rounded-2xl border border-borderClr/30 bg-gray-950/40 hover:border-accentBrand/60 transition-all flex flex-col justify-between gap-3 shadow-lg"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-white">{entry.term}</h4>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  entry.category === 'Core' ? 'bg-cyan-500/20 text-cyan-300' :
                  entry.category === 'Greeks' ? 'bg-amber-500/20 text-amber-300' :
                  entry.category === 'Metrics' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-purple-500/20 text-purple-300'
                }`}>
                  {entry.category}
                </span>
              </div>
              <p className="text-xs font-semibold text-accentCyan">
                {entry.oneLine}
              </p>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                {entry.explanation}
              </p>
            </div>

            <div className="pt-2 border-t border-borderClr/20 space-y-1 text-[10px] text-gray-400">
              <div><strong className="text-gray-300">Example:</strong> {entry.example}</div>
              <div className="text-gray-500">📍 {entry.locationInOptionChief}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
