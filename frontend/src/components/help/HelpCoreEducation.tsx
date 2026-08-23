import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Activity, 
  Zap, 
  Info 
} from 'lucide-react';

export const HelpCoreEducation: React.FC = () => {
  const [eduTab, setEduTab] = useState<'call' | 'put' | 'moneyness' | 'expiry' | 'premium'>('call');
  const [callSpot, setCallSpot] = useState<number>(25000);
  const [putSpot, setPutSpot] = useState<number>(25000);

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-1 border-b border-borderClr/30 pb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Options 101 Masterclass
          </span>
          <h2 className="text-lg md:text-xl font-extrabold text-white">
            Core Options Education & Fundamental Mechanics
          </h2>
        </div>
        <p className="text-xs text-gray-400">
          Learn how Call & Put options work with interactive real-world numerical examples, payoff curves, and moneyness zones.
        </p>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'call', label: '1. Call Options (CE)', icon: TrendingUp },
          { id: 'put', label: '2. Put Options (PE)', icon: TrendingDown },
          { id: 'moneyness', label: '3. ITM, ATM & OTM Zones', icon: Activity },
          { id: 'expiry', label: '4. Expiry Cycles & DTE', icon: Clock },
          { id: 'premium', label: '5. Option Premium & IV', icon: Zap }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = eduTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setEduTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                isSelected
                  ? 'bg-accentBrand text-white border-accentBrand shadow-md shadow-accentBrand/20'
                  : 'bg-gray-950/60 text-gray-400 border-borderClr/30 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CALL OPTIONS */}
      {eduTab === 'call' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-borderClr/40 bg-gray-950/40 space-y-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                What is a Call Option (CE)?
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                A <strong>Call Option</strong> gives the buyer the right (but not the obligation) to <strong>BUY</strong> the underlying asset (e.g. NIFTY) at a set price (Strike Price) before or on contract expiration.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                  <span className="text-xs font-bold text-emerald-300 block mb-1">🟢 Call Buyer (Long Call)</span>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Expects market to <strong>RISE</strong>. Pays premium upfront. Maximum loss is capped at premium paid; potential profit is unlimited.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30">
                  <span className="text-xs font-bold text-red-300 block mb-1">🔴 Call Seller (Short Call)</span>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Expects market to <strong>STAY FLAT or FALL</strong>. Receives premium. Profit capped at premium; risk is undefined if spot surges.
                  </p>
                </div>
              </div>
            </div>

            {/* Numerical Example Card */}
            <div className="p-4 rounded-xl bg-gray-950 border border-borderClr/40 space-y-2 text-xs">
              <span className="text-[10px] font-bold text-accentCyan uppercase tracking-wider block">
                Realistic Numerical Example (NIFTY 25,000)
              </span>
              <ul className="space-y-1 text-gray-300 text-[11px]">
                <li>• <strong>Strike Price (K)</strong>: ₹25,000 Call</li>
                <li>• <strong>Premium Paid</strong>: ₹150 per share (Lot of 50 = ₹7,500 total cost)</li>
                <li>• <strong>Breakeven Point</strong>: Strike (₹25,000) + Premium (₹150) = <strong>₹25,150</strong></li>
                <li>• <strong>If NIFTY expires at ₹25,400</strong>: Profit = (25,400 - 25,150) × 50 = <strong>+₹12,500 (+166%)</strong></li>
                <li>• <strong>If NIFTY expires below ₹25,000</strong>: Max Loss = <strong>-₹7,500 (100% of premium)</strong></li>
              </ul>
            </div>
          </div>

          {/* Right Payoff Simulation */}
          <div className="lg:col-span-5 glass-panel p-5 rounded-2xl border border-borderClr/40 bg-black/60 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between border-b border-borderClr/30 pb-2 text-xs font-bold text-white">
              <span>Long Call Payoff (Strike ₹25,000 @ ₹150)</span>
              <span className="text-emerald-400 font-mono">Spot: ₹{callSpot.toLocaleString()}</span>
            </div>

            {/* Interactive SVG Payoff */}
            <div className="w-full h-44 bg-gray-950 rounded-xl relative border border-borderClr/30 p-2">
              <svg className="w-full h-full" viewBox="0 0 300 140">
                {/* Zero line */}
                <line x1="0" y1="90" x2="300" y2="90" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                <text x="5" y="85" fill="#94a3b8" fontSize="8">₹0 P&L</text>

                {/* Long Call Payoff Line */}
                <path
                  d="M 20 115 L 140 115 L 280 25"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                />

                {/* Breakeven Marker */}
                <circle cx="170" cy="90" r="3.5" fill="#38bdf8" />
                <text x="160" y="105" fill="#38bdf8" fontSize="8" fontWeight="bold">Breakeven 25,150</text>

                {/* Current Spot Indicator */}
                {(() => {
                  const normalizedX = 20 + ((callSpot - 24000) / 2000) * 260;
                  const currentY = callSpot <= 25000 ? 115 : Math.max(25, 115 - ((callSpot - 25000) / 1000) * 90);
                  const pnlVal = (callSpot - 25150) * 50;
                  return (
                    <g>
                      <circle cx={normalizedX} cy={currentY} r="5" fill="#eab308" className="animate-pulse" />
                      <text x={Math.min(200, Math.max(30, normalizedX - 30))} y={currentY - 10} fill={pnlVal >= 0 ? '#10b981' : '#f43f5e'} fontSize="9" fontWeight="bold">
                        P&L: {pnlVal >= 0 ? `+₹${pnlVal.toLocaleString()}` : `-₹${Math.abs(pnlVal).toLocaleString()}`}
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Spot Adjustment Slider */}
            <div className="space-y-1.5 bg-gray-950 p-3 rounded-xl border border-borderClr/30">
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Simulate Expiry Spot Price</span>
                <span className="font-mono text-emerald-400 font-bold">₹{callSpot.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="24000"
                max="26000"
                step="50"
                value={callSpot}
                onChange={(e) => setCallSpot(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-gray-800 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PUT OPTIONS */}
      {eduTab === 'put' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-borderClr/40 bg-gray-950/40 space-y-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                What is a Put Option (PE)?
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                A <strong>Put Option</strong> gives the buyer the right to <strong>SELL</strong> the underlying asset at a set strike price before expiration. Used for profiting from drops or hedging portfolios.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30">
                  <span className="text-xs font-bold text-purple-300 block mb-1">🟣 Put Buyer (Long Put)</span>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Expects market to <strong>CRASH or DROP</strong>. Pays premium. Profits as spot falls below (Strike - Premium). Max loss is limited to premium.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30">
                  <span className="text-xs font-bold text-blue-300 block mb-1">🔵 Put Seller (Short Put)</span>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Expects market to <strong>STAY ABOVE STRIKE</strong>. Collects premium upfront. Profitable if market consolidates or rallies.
                  </p>
                </div>
              </div>
            </div>

            {/* Numerical Example */}
            <div className="p-4 rounded-xl bg-gray-950 border border-borderClr/40 space-y-2 text-xs">
              <span className="text-[10px] font-bold text-accentCyan uppercase tracking-wider block">
                Realistic Numerical Example (NIFTY 25,000)
              </span>
              <ul className="space-y-1 text-gray-300 text-[11px]">
                <li>• <strong>Strike Price (K)</strong>: ₹25,000 Put</li>
                <li>• <strong>Premium Paid</strong>: ₹140 per share (Lot of 50 = ₹7,000 total cost)</li>
                <li>• <strong>Breakeven Point</strong>: Strike (₹25,000) - Premium (₹140) = <strong>₹24,860</strong></li>
                <li>• <strong>If NIFTY crashes to ₹24,500</strong>: Profit = (24,860 - 24,500) × 50 = <strong>+₹18,000 (+257%)</strong></li>
                <li>• <strong>If NIFTY stays above ₹25,000</strong>: Max Loss = <strong>-₹7,000 (100% of premium)</strong></li>
              </ul>
            </div>
          </div>

          {/* Right Payoff Simulation */}
          <div className="lg:col-span-5 glass-panel p-5 rounded-2xl border border-borderClr/40 bg-black/60 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between border-b border-borderClr/30 pb-2 text-xs font-bold text-white">
              <span>Long Put Payoff (Strike ₹25,000 @ ₹140)</span>
              <span className="text-red-400 font-mono">Spot: ₹{putSpot.toLocaleString()}</span>
            </div>

            {/* SVG Payoff */}
            <div className="w-full h-44 bg-gray-950 rounded-xl relative border border-borderClr/30 p-2">
              <svg className="w-full h-full" viewBox="0 0 300 140">
                <line x1="0" y1="90" x2="300" y2="90" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                <text x="5" y="85" fill="#94a3b8" fontSize="8">₹0 P&L</text>

                {/* Long Put Payoff Line */}
                <path
                  d="M 20 25 L 160 115 L 280 115"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                />

                {/* Breakeven Marker */}
                <circle cx="130" cy="90" r="3.5" fill="#38bdf8" />
                <text x="80" y="105" fill="#38bdf8" fontSize="8" fontWeight="bold">Breakeven 24,860</text>

                {/* Spot Indicator */}
                {(() => {
                  const normalizedX = 20 + ((putSpot - 24000) / 2000) * 260;
                  const currentY = putSpot >= 25000 ? 115 : Math.max(25, 25 + ((putSpot - 24000) / 1000) * 90);
                  const pnlVal = (24860 - putSpot) * 50;
                  return (
                    <g>
                      <circle cx={normalizedX} cy={currentY} r="5" fill="#eab308" className="animate-pulse" />
                      <text x={Math.min(200, Math.max(30, normalizedX - 30))} y={currentY - 10} fill={pnlVal >= 0 ? '#10b981' : '#f43f5e'} fontSize="9" fontWeight="bold">
                        P&L: {pnlVal >= 0 ? `+₹${pnlVal.toLocaleString()}` : `-₹${Math.abs(pnlVal).toLocaleString()}`}
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>

            <div className="space-y-1.5 bg-gray-950 p-3 rounded-xl border border-borderClr/30">
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Simulate Expiry Spot Price</span>
                <span className="font-mono text-red-400 font-bold">₹{putSpot.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="24000"
                max="26000"
                step="50"
                value={putSpot}
                onChange={(e) => setPutSpot(Number(e.target.value))}
                className="w-full accent-red-500 cursor-pointer h-1.5 bg-gray-800 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MONEYNESS (ITM, ATM, OTM) */}
      {eduTab === 'moneyness' && (
        <div className="flex flex-col gap-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 space-y-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-block">
                ITM • In-The-Money
              </span>
              <h4 className="text-sm font-bold text-white">Has Intrinsic Value</h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                Options that already possess real cash value if exercised right now.
              </p>
              <div className="text-[11px] text-gray-400 space-y-1 pt-2 border-t border-borderClr/20">
                <div>• <strong>Call ITM</strong>: Strike &lt; Spot (e.g. 24,800 Call when Spot = 25,000)</div>
                <div>• <strong>Put ITM</strong>: Strike &gt; Spot (e.g. 25,200 Put when Spot = 25,000)</div>
                <div>• <strong>Delta</strong>: Higher (|Delta| &gt; 0.50 to 1.00)</div>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 bg-amber-950/10 space-y-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-block">
                ATM • At-The-Money
              </span>
              <h4 className="text-sm font-bold text-white">Closest to Spot Price</h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                Strikes closest to the current market spot price. Highest trading liquidity and highest Gamma.
              </p>
              <div className="text-[11px] text-gray-400 space-y-1 pt-2 border-t border-borderClr/20">
                <div>• <strong>Call/Put ATM</strong>: Strike ≈ Spot (e.g. 25,000 Strike)</div>
                <div>• <strong>Delta</strong>: Approximately 0.50 for Calls, -0.50 for Puts</div>
                <div>• <strong>Gamma & Extrinsic Value</strong>: Maximum peak</div>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-cyan-500/30 bg-cyan-950/10 space-y-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 inline-block">
                OTM • Out-Of-The-Money
              </span>
              <h4 className="text-sm font-bold text-white">100% Extrinsic Time Value</h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                Options that have zero intrinsic value. The entire premium consists of time decay and volatility hope.
              </p>
              <div className="text-[11px] text-gray-400 space-y-1 pt-2 border-t border-borderClr/20">
                <div>• <strong>Call OTM</strong>: Strike &gt; Spot (e.g. 25,300 Call when Spot = 25,000)</div>
                <div>• <strong>Put OTM</strong>: Strike &lt; Spot (e.g. 24,700 Put when Spot = 25,000)</div>
                <div>• <strong>Expires worthless (₹0)</strong> if spot doesn't reach strike</div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-950 border border-borderClr/40 flex items-start gap-3 text-xs text-gray-300">
            <Info className="w-5 h-5 text-accentCyan shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">How OptionChief Visualizes Moneyness:</strong> In the OptionChief Option Chain Table, ITM rows are highlighted with a soft shaded background tint, while ATM is flagged with a bright yellow focal marker. This allows you to instantly spot the strike boundary without manual calculation.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXPIRY CYCLES */}
      {eduTab === 'expiry' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          <div className="glass-panel p-5 rounded-2xl border border-borderClr/40 bg-gray-950/40 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Weekly vs Monthly Expiry Cycles
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              NSE index options (NIFTY, BANKNIFTY, FINNIFTY) expire on designated weekly days (e.g. Thursdays).
            </p>
            <div className="space-y-2 text-xs text-gray-300">
              <div className="p-3 rounded-lg bg-gray-900 border border-borderClr/30">
                <strong className="text-cyan-300 block mb-1">Weekly Expiries (0 - 7 DTE):</strong>
                <span>Rapid daily Theta decay. Great for option sellers harvesting decay, but higher Gamma pin risk on expiry day.</span>
              </div>
              <div className="p-3 rounded-lg bg-gray-900 border border-borderClr/30">
                <strong className="text-purple-300 block mb-1">Monthly Expiries (15 - 45 DTE):</strong>
                <span>More forgiving Greek stability, wider breakevens, and smoother trend protection with lower Gamma acceleration.</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-borderClr/40 bg-gray-950/40 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              The "Theta Decay Cliff"
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Option time decay is non-linear. An option loses a small amount of value per day at 45 DTE, but accelerates exponentially during the final 10 days before expiry.
            </p>
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
              <strong>Quant Rule:</strong> OptionChief's automated scanners look for optimal credit collection windows between 3 to 14 DTE, maximizing daily Theta harvest per rupee of margin deployed.
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: OPTION PREMIUM */}
      {eduTab === 'premium' && (
        <div className="glass-panel p-6 rounded-2xl border border-borderClr/40 bg-gray-950/40 space-y-4 animate-fadeIn">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-accentCyan" />
            Deconstructing the Option Premium Equation
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            Every option price you see on OptionChief consists of two components:
          </p>

          <div className="p-4 rounded-xl bg-black/80 border border-cyan-500/30 text-center font-mono text-sm md:text-base text-cyan-300 font-bold">
            Total Option Premium = Intrinsic Value + Extrinsic (Time) Value
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-gray-900 border border-borderClr/30 space-y-1.5">
              <strong className="text-emerald-400 block">1. Intrinsic Value (Real Cash Value)</strong>
              <p className="text-gray-300 leading-relaxed">
                The amount by which an option is In-The-Money. For a 24,800 Call when NIFTY is 25,000, Intrinsic Value = ₹200.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-900 border border-borderClr/30 space-y-1.5">
              <strong className="text-purple-400 block">2. Extrinsic Value (Time & Volatility)</strong>
              <p className="text-gray-300 leading-relaxed">
                The speculative premium above intrinsic value determined by Days-to-Expiry and Implied Volatility (IV). Decays to ₹0 at expiry.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
