import React, { useState } from 'react';
import { Zap } from 'lucide-react';

interface ChainField {
  name: string;
  category: 'calls' | 'strike' | 'puts' | 'sentiment';
  description: string;
  importance: string;
  example: string;
  whereToFind: string;
}

const CHAIN_FIELDS: ChainField[] = [
  {
    name: 'Strike Price',
    category: 'strike',
    description: 'The agreed fixed price at which the option holder has the right to buy (Call) or sell (Put) the underlying asset.',
    importance: 'Anchor of the entire contract. Distance of strike from current spot dictates probability and premium value.',
    example: '25,000 Strike on NIFTY index.',
    whereToFind: 'Central highlighted column in OptionChain matrix.'
  },
  {
    name: 'Call LTP & Put LTP',
    category: 'calls',
    description: 'Last Traded Price of the Call option (left side) and Put option (right side). Ticks in real-time from market feeds.',
    importance: 'The actual price you pay to buy or receive to sell 1 share/unit of the option.',
    example: 'NIFTY 25,000 CE LTP = ₹152.40 (Lot of 50 = ₹7,620).',
    whereToFind: 'Adjacent to Bid/Ask columns on Calls & Puts sides.'
  },
  {
    name: 'Delta (Δ)',
    category: 'calls',
    description: 'Measures how much the option price moves for every ₹1 movement in the underlying index.',
    importance: 'Call Delta ranges from 0 to +1.00; Put Delta ranges from -1.00 to 0. Also serves as an approximate proxy for probability of expiring ITM.',
    example: 'Delta = 0.50 means option price increases by ₹50 when NIFTY rises by ₹100.',
    whereToFind: 'Greeks column on Call and Put panels.'
  },
  {
    name: 'Theta (Θ)',
    category: 'calls',
    description: 'Daily time decay rate. Measures the loss in option value per calendar day assuming spot and IV remain constant.',
    importance: 'Negative for option buyers (daily capital erosion); positive cash-flow decay for option sellers.',
    example: 'Theta = -₹14.50 means the contract loses ₹14.50 in value over 24 hours due to time passage.',
    whereToFind: 'Greeks column on Call and Put panels.'
  },
  {
    name: 'Gamma (Γ)',
    category: 'calls',
    description: 'The rate of change of Delta per ₹1 move in spot price. Highest for At-The-Money options near expiry.',
    importance: 'High Gamma creates violent Delta shifts on expiry day (Pin Risk). Option sellers must manage Gamma exposure.',
    example: 'Gamma = 0.003 means Delta increases from 0.50 to 0.53 on a ₹10 index rise.',
    whereToFind: 'Greeks column on Call and Put panels.'
  },
  {
    name: 'Implied Volatility (IV %)',
    category: 'calls',
    description: 'The market-implied annualized volatility percentage extracted from option prices using the Black-Scholes model.',
    importance: 'Higher IV makes all options expensive (seller-friendly); lower IV makes options cheap (buyer-friendly).',
    example: 'NIFTY IV at 13.8% vs historical average 12.5%.',
    whereToFind: 'IV column on Call and Put rows.'
  },
  {
    name: 'Open Interest (OI) & Volume',
    category: 'calls',
    description: 'Total number of active outstanding contracts (OI) and number of contracts traded today (Volume).',
    importance: 'Large OI build-up represents institutional support (heavy Put OI) and overhead resistance (heavy Call OI).',
    example: '25,500 Call OI = 1.2 Crore shares (major resistance wall).',
    whereToFind: 'Outer columns on left and right of chain.'
  },
  {
    name: 'Put-Call Ratio (PCR)',
    category: 'sentiment',
    description: 'Total Put Open Interest divided by Total Call Open Interest across all active strikes for the selected expiry.',
    importance: 'Sentiment indicator: PCR > 1.20 indicates Bullish bias; PCR < 0.70 indicates Bearish bias; 0.90-1.10 is Neutral.',
    example: 'NIFTY PCR = 1.24 (Bullish Put writing domination).',
    whereToFind: 'Top summary banner above Option Chain.'
  },
  {
    name: 'Max Pain Strike',
    category: 'sentiment',
    description: 'The strike price at which the maximum aggregate value of option buyer contracts will expire completely worthless.',
    importance: 'On contract expiry days, index spot prices frequently gravitate toward the Max Pain level due to market maker delta hedging.',
    example: 'Max Pain = 25,000 Strike.',
    whereToFind: 'Top summary banner above Option Chain.'
  }
];

export const HelpOptionChainGuide: React.FC = () => {
  const [selectedField, setSelectedField] = useState<ChainField>(CHAIN_FIELDS[0]);

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-1 border-b border-borderClr/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-accentBrand/15 text-accentBrand border border-accentBrand/30">
            Chain Matrix Guide
          </span>
          <h2 className="text-lg md:text-xl font-extrabold text-white">
            Complete Visual Guide to the Option Chain
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Inspect and master every metric displayed on the OptionChief Option Chain.
        </p>
      </div>

      {/* Visual Option Chain Mock Preview */}
      <div className="glass-panel p-5 rounded-2xl border border-borderClr/40 bg-gray-950/60 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borderClr/30 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-white uppercase tracking-wider">
              NIFTY 50 Option Chain (Sample Expiry)
            </span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
              Live PCR: 1.18 (Mild Bullish)
            </span>
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/25">
              Max Pain: 25,000
            </span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">Spot: ₹25,024.50 (+0.42%)</span>
        </div>

        {/* Mini Option Chain Table Wireframe */}
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs font-mono">
            <thead>
              <tr className="text-[10px] font-bold uppercase text-gray-400 border-b border-borderClr/30 bg-gray-900/50">
                <th className="py-2 px-2 text-left text-emerald-400">Call OI</th>
                <th className="py-2 px-2 text-emerald-400">Delta</th>
                <th className="py-2 px-2 text-emerald-400">Call LTP</th>
                <th className="py-2 px-3 text-white bg-gray-800/80">Strike</th>
                <th className="py-2 px-2 text-red-400">Put LTP</th>
                <th className="py-2 px-2 text-red-400">Delta</th>
                <th className="py-2 px-2 text-right text-red-400">Put OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderClr/15 text-[11px]">
              <tr className="bg-emerald-950/10 hover:bg-emerald-950/20 transition-colors">
                <td className="py-2 px-2 text-left text-gray-400">42.5L</td>
                <td className="py-2 px-2 text-emerald-300">0.72</td>
                <td className="py-2 px-2 text-emerald-400 font-bold">₹284.10</td>
                <td className="py-2 px-3 font-bold text-cyan-300 bg-gray-900/80">24,800</td>
                <td className="py-2 px-2 text-red-400 font-bold">₹58.20</td>
                <td className="py-2 px-2 text-red-300">-0.28</td>
                <td className="py-2 px-2 text-right text-gray-400">68.1L</td>
              </tr>
              <tr className="bg-emerald-950/10 hover:bg-emerald-950/20 transition-colors">
                <td className="py-2 px-2 text-left text-gray-400">58.2L</td>
                <td className="py-2 px-2 text-emerald-300">0.61</td>
                <td className="py-2 px-2 text-emerald-400 font-bold">₹198.50</td>
                <td className="py-2 px-3 font-bold text-cyan-300 bg-gray-900/80">24,900</td>
                <td className="py-2 px-2 text-red-400 font-bold">₹92.40</td>
                <td className="py-2 px-2 text-red-300">-0.39</td>
                <td className="py-2 px-2 text-right text-gray-400">92.4L</td>
              </tr>
              {/* ATM Strike Highlight */}
              <tr className="bg-amber-500/10 border-y border-amber-500/40 font-bold">
                <td className="py-2.5 px-2 text-left text-gray-300">95.4L</td>
                <td className="py-2.5 px-2 text-emerald-300">0.51</td>
                <td className="py-2.5 px-2 text-emerald-300 font-extrabold">₹134.20</td>
                <td className="py-2.5 px-3 font-black text-amber-300 bg-amber-500/20 flex items-center justify-center gap-1">
                  <span>25,000</span>
                  <span className="text-[9px] bg-amber-400 text-black px-1 rounded font-sans">ATM</span>
                </td>
                <td className="py-2.5 px-2 text-red-300 font-extrabold">₹128.50</td>
                <td className="py-2.5 px-2 text-red-300">-0.49</td>
                <td className="py-2.5 px-2 text-right text-gray-300">1.1 Cr</td>
              </tr>
              <tr className="hover:bg-red-950/10 transition-colors">
                <td className="py-2 px-2 text-left text-gray-400">1.4 Cr</td>
                <td className="py-2 px-2 text-emerald-300">0.38</td>
                <td className="py-2 px-2 text-emerald-400 font-bold">₹82.10</td>
                <td className="py-2 px-3 font-bold text-cyan-300 bg-gray-900/80">25,100</td>
                <td className="py-2 px-2 text-red-400 font-bold">₹176.30</td>
                <td className="py-2 px-2 text-red-300">-0.62</td>
                <td className="py-2 px-2 text-right text-gray-400">45.0L</td>
              </tr>
              <tr className="hover:bg-red-950/10 transition-colors">
                <td className="py-2 px-2 text-left text-gray-400">1.8 Cr</td>
                <td className="py-2 px-2 text-emerald-300">0.26</td>
                <td className="py-2 px-2 text-emerald-400 font-bold">₹46.50</td>
                <td className="py-2 px-3 font-bold text-cyan-300 bg-gray-900/80">25,200</td>
                <td className="py-2 px-2 text-red-400 font-bold">₹240.10</td>
                <td className="py-2 px-2 text-red-300">-0.74</td>
                <td className="py-2 px-2 text-right text-gray-400">22.8L</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Field Details Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CHAIN_FIELDS.map((f, idx) => {
          const isSelected = selectedField.name === f.name;
          return (
            <div
              key={idx}
              onClick={() => setSelectedField(f)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                isSelected
                  ? 'bg-accentBrand/15 border-accentBrand shadow-lg shadow-accentBrand/10'
                  : 'bg-gray-950/40 border-borderClr/30 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{f.name}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-mono font-bold ${
                  f.category === 'calls' ? 'bg-emerald-500/20 text-emerald-300' :
                  f.category === 'puts' ? 'bg-red-500/20 text-red-300' :
                  f.category === 'strike' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/20 text-purple-300'
                }`}>
                  {f.category}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                {f.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Selected Field Deep Dive Card */}
      <div className="p-5 rounded-2xl bg-gray-950 border border-accentBrand/40 space-y-3 text-xs text-left">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accentCyan" />
          <h3 className="text-sm font-extrabold text-white">
            Deep Dive: {selectedField.name}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1">
            <strong className="text-gray-400 uppercase tracking-wider text-[10px] block">What It Means:</strong>
            <p className="text-gray-200 leading-relaxed text-[11px]">{selectedField.description}</p>
          </div>

          <div className="space-y-1">
            <strong className="text-gray-400 uppercase tracking-wider text-[10px] block">Why It Matters to Traders:</strong>
            <p className="text-gray-200 leading-relaxed text-[11px]">{selectedField.importance}</p>
          </div>

          <div className="space-y-1">
            <strong className="text-gray-400 uppercase tracking-wider text-[10px] block">Live Example & Location:</strong>
            <p className="text-cyan-300 leading-relaxed text-[11px]">{selectedField.example}</p>
            <span className="text-[10px] text-gray-500 block mt-1">📍 {selectedField.whereToFind}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
