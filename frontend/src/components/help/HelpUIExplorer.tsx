import React, { useState } from 'react';
import { 
  Layers, 
  Search, 
  TrendingUp, 
  Bell, 
  Zap, 
  Briefcase, 
  CheckCircle2, 
  Info,
  ArrowRight
} from 'lucide-react';

interface Hotspot {
  id: number;
  title: string;
  tabKey: string;
  tag: string;
  description: string;
  features: string[];
  proTip: string;
  shortcut?: string;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: 1,
    title: 'Symbol & Underlying Selector',
    tabKey: 'chain',
    tag: 'Market Feed',
    description: 'Select your target index or F&O equity. OptionChief dynamically fetches live spot prices, percentage changes, daily ranges, and underlying lot sizes (e.g. NIFTY 50, BANKNIFTY 30).',
    features: [
      'Multi-index support: NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX',
      'Instant spot price & daily change telemetry',
      'Automatic lot normalization across all strategy calculations'
    ],
    proTip: 'Spot index changes update in sub-seconds. Switching symbol automatically refreshes all option chain strikes and Greeks.',
    shortcut: 'Top Header Bar'
  },
  {
    id: 2,
    title: 'Expiry Cycle Selector',
    tabKey: 'chain',
    tag: 'Contract Cycles',
    description: 'Switch between near-week expiries, next-week expiries, and monthly expiration contracts. OptionChief computes exact Days-To-Expiry (DTE) in real time.',
    features: [
      'Weekly & Monthly expiration cycles fetched live',
      'Exact DTE (Days to Expiry) countdown',
      'Option chains and scanners instantly adjust for target expiration'
    ],
    proTip: 'Shorter DTE options have higher Gamma pin risk and rapid Theta decay; longer DTE options have higher Vega sensitivity.',
    shortcut: 'Top Expiry Bar'
  },
  {
    id: 3,
    title: 'Live Option Chain Matrix & Greeks',
    tabKey: 'chain',
    tag: 'Core Matrix',
    description: 'Comprehensive options chain displaying Calls on the left and Puts on the right with real-time LTP, Bid/Ask, Delta, Theta, Gamma, IV, Volume, and Open Interest.',
    features: [
      'Color-coded ITM, ATM, and OTM strike zones',
      'Put-Call Ratio (PCR) & Max Pain pin level display',
      '1-Click click-to-add legs directly into Strategy Builder'
    ],
    proTip: 'Click any Bid or Ask cell to instantly stage that option leg into the Strategy Analyzer sandbox for payoff simulation.',
    shortcut: 'Tab: Option Chain'
  },
  {
    id: 4,
    title: 'Dynamic Market Regime Screener',
    tabKey: 'scanner',
    tag: 'Quantitative Edge',
    description: 'Quantitative scanning engine that screens thousands of strike permutations in milliseconds to find high-probability 1:3:2 Ratio Spreads, Iron Condors, and Butterflies.',
    features: [
      'Automated Volatility Smile & Skew detection',
      'Probability of Profit (POP %) & Return on Margin (ROC) calculations',
      'Direct "Sandbox" export to modify strikes in Payoff Lab'
    ],
    proTip: 'Filter by minimum POP >= 70% and positive Net Credit to isolate defined-risk trades with statistical positive expectancy.',
    shortcut: 'Tab: Strategy Scanner'
  },
  {
    id: 5,
    title: 'Strategy Analyzer & Payoff Simulator',
    tabKey: 'builder',
    tag: 'Payoff Lab',
    description: 'Simulate up to 6 custom option legs (Calls, Puts, Futures) with interactive T+0 Today curves, Expiry curves, IV offset shocks (+/-30%), and time decay step forward.',
    features: [
      'Dual curve visualization: T+0 (Today) vs Expiry Payoff',
      'Interactive IV Offset slider & Date Decay (DTE) slider',
      'Combined Strategy Greeks: Net Delta, Gamma, Theta, Vega, Rho'
    ],
    proTip: 'The vertical space between the T+0 curve and Expiry curve represents unharvested Theta (daily time decay) waiting to be collected.',
    shortcut: 'Tab: Strategy Analyzer'
  },
  {
    id: 6,
    title: '5m/15m RSI Momentum Scalper',
    tabKey: 'rsi_scanner',
    tag: 'Momentum Signals',
    description: 'Real-time multi-timeframe RSI screener detecting intraday breakouts, oversold bounces (<30), and overbought rejections (>70) with auto trailing stops.',
    features: [
      'Multi-timeframe RSI analysis (5m, 15m, 1h, Daily)',
      'Directional confluence filters for index and heavyweights',
      'Direct strategy recommendations tailored to momentum strength'
    ],
    proTip: 'Combine 15m RSI oversold bounces with Bull Put Spreads for high-probability mean-reversion entries.',
    shortcut: 'Tab: RSI Scanner'
  },
  {
    id: 7,
    title: '24/7 Telegram Instant Alerts Engine',
    tabKey: 'alerts',
    tag: 'Automation',
    description: 'Autonomous background scanning daemon that runs continuously during market hours, triggering audio chimes and delivering instant push alerts directly to your Telegram bot.',
    features: [
      'Customizable screening rules (POP, Net Credit, Greek limits)',
      'Automated Telegram Bot push notifications to your mobile phone',
      'Historical trigger log with entry pricing and timestamps'
    ],
    proTip: 'Activate the Auto-Scanner toggle and connect your Telegram Bot Token to receive hands-free alerts wherever you are.',
    shortcut: 'Tab: Strategy Alerts'
  },
  {
    id: 8,
    title: 'Paper Trading Book & Live Broker Execution',
    tabKey: 'portfolios',
    tag: 'Execution Engine',
    description: 'Track simulated paper trades with live mark-to-market (MTM) P&L, or connect Dhan HQ / Kotak Neo API keys for 1-click multi-leg basket order execution.',
    features: [
      'Simulated paper trading with real-time ticking MTM P&L',
      'Dhan HQ & Kotak Neo live broker API integration',
      'Automatic lot normalization and simultaneous multi-leg basket routing'
    ],
    proTip: 'Always use basket orders for multi-leg strategies to ensure simultaneous fill execution and maximum exchange margin relief.',
    shortcut: 'Tab: Paper Trading Book'
  }
];

export const HelpUIExplorer: React.FC = () => {
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot>(HOTSPOTS[0]);

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-1 border-b border-borderClr/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-accentBrand/15 text-accentBrand border border-accentBrand/30">
            Interactive Visual Guide
          </span>
          <h2 className="text-lg md:text-xl font-extrabold text-white">
            Understanding the OptionChief Terminal Interface
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Click any numbered hotspot below to explore its function, key features, and pro tips.
        </p>
      </div>

      {/* Hotspots Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {HOTSPOTS.map((h) => {
          const isSelected = selectedHotspot.id === h.id;
          return (
            <button
              key={h.id}
              onClick={() => setSelectedHotspot(h)}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all duration-200 ${
                isSelected
                  ? 'bg-accentBrand text-white border-accentBrand shadow-lg shadow-accentBrand/20 scale-105'
                  : 'bg-gray-950/70 border-borderClr/40 text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                isSelected ? 'bg-white text-black' : 'bg-gray-800 text-gray-300'
              }`}>
                {h.id}
              </span>
              <span className="text-[10px] font-bold truncate max-w-full">
                {h.title.split(' ')[0]} {h.title.split(' ')[1] || ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Hotspot Detail Card */}
      <div className="glass-panel border border-accentBrand/30 rounded-2xl p-6 md:p-8 bg-gradient-to-b from-gray-950 via-slate-950 to-gray-950 flex flex-col lg:flex-row gap-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accentBrand/5 rounded-full blur-3xl pointer-events-none" />

        {/* Left Info Column */}
        <div className="lg:w-7/12 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-accentBrand text-white font-black flex items-center justify-center text-sm shadow-md">
              {selectedHotspot.id}
            </span>
            <div>
              <h3 className="text-base md:text-lg font-extrabold text-white">
                {selectedHotspot.title}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-accentCyan font-bold mt-0.5">
                <span>Tag: {selectedHotspot.tag}</span>
                <span>•</span>
                <span className="text-gray-400">Location: {selectedHotspot.shortcut}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            {selectedHotspot.description}
          </p>

          <div className="space-y-2 mt-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Core Capabilities:
            </span>
            {selectedHotspot.features.map((feat, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{feat}</span>
              </div>
            ))}
          </div>

          {/* Pro Tip Box */}
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-2.5 text-xs text-cyan-200 mt-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-cyan-300 uppercase tracking-wider text-[10px] block">Pro Trader Edge:</strong>
              <p className="text-[11px] text-gray-300 mt-0.5 leading-relaxed">{selectedHotspot.proTip}</p>
            </div>
          </div>
        </div>

        {/* Right Visual Simulation Mock */}
        <div className="lg:w-5/12 flex flex-col justify-between p-5 rounded-xl bg-black/60 border border-borderClr/40">
          <div className="flex items-center justify-between border-b border-borderClr/30 pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Terminal Visual Blueprint
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              Module #{selectedHotspot.id}
            </span>
          </div>

          <div className="my-6 flex flex-col items-center justify-center text-center p-6 rounded-xl bg-gray-950 border border-borderClr/30 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-accentBrand/10 border border-accentBrand/30 flex items-center justify-center text-accentBrand">
              {selectedHotspot.id === 1 && <Layers className="w-7 h-7" />}
              {selectedHotspot.id === 2 && <Zap className="w-7 h-7" />}
              {selectedHotspot.id === 3 && <Layers className="w-7 h-7" />}
              {selectedHotspot.id === 4 && <Search className="w-7 h-7" />}
              {selectedHotspot.id === 5 && <TrendingUp className="w-7 h-7" />}
              {selectedHotspot.id === 6 && <Zap className="w-7 h-7" />}
              {selectedHotspot.id === 7 && <Bell className="w-7 h-7" />}
              {selectedHotspot.id === 8 && <Briefcase className="w-7 h-7" />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">{selectedHotspot.title}</h4>
              <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                data-help-target="{selectedHotspot.tabKey}"
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 border-t border-borderClr/20 pt-3">
            <span>Ready to explore?</span>
            <button
              onClick={() => {
                const target = document.getElementById(selectedHotspot.tabKey);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-accentBrand hover:text-accentCyan font-bold flex items-center gap-1 transition-colors"
            >
              <span>Jump to Section</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
