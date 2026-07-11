import React, { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { projectStrategy } from '../utils/optionsMath';
import {
  ResponsiveContainer,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Line,
  Area,
  CartesianGrid
} from 'recharts';
import { Clock, TrendingUp, HelpCircle } from 'lucide-react';

const getRiskRewardRatio = (maxProfit: number | string, maxLoss: number | string): string => {
  if (typeof maxProfit !== 'number' || typeof maxLoss !== 'number') {
    return '1:Unlimited';
  }
  const absLoss = Math.abs(maxLoss);
  if (absLoss <= 0) {
    return '0:1';
  }
  const ratio = maxProfit / absLoss;
  return `1:${ratio.toFixed(2)}`;
};

interface PayoffChartProps {
  customLegs?: any[];
  customSpot?: number;
  customExpiry?: string;
  customSymbol?: string;
}

export const PayoffChart: React.FC<PayoffChartProps> = ({
  customLegs,
  customSpot,
  customExpiry,
  customSymbol
}) => {
  const storeState = useStore();
  const legs = customLegs !== undefined ? customLegs : storeState.legs;
  const underlying = storeState.underlying;
  const spot = customSpot !== undefined ? customSpot : (underlying?.spot || 100);
  const selectedExpiry = customExpiry !== undefined ? customExpiry : storeState.selectedExpiry;
  const symbol = customSymbol !== undefined ? customSymbol : (underlying?.symbol || "NIFTY");

  const [daysPassed, setDaysPassed] = useState(0);
  const [ivOffset, setIvOffset] = useState(0);

  // Calculate total days to expiry
  const totalDays = useMemo(() => {
    if (!selectedExpiry) return 10;
    const today = new Date();
    const expiryDate = new Date(selectedExpiry);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [selectedExpiry]);

  // Project PnL payoff curve and metrics
  const { payoff, metrics } = useMemo(() => {
    if (legs.length === 0) {
      return { payoff: [], metrics: null };
    }
    return projectStrategy(legs, spot, daysPassed, ivOffset, 0.05, symbol);
  }, [legs, spot, daysPassed, ivOffset, symbol]);

  if (legs.length === 0) {
    return (
      <div className="bg-cardBg rounded-xl p-8 border border-borderClr/40 text-center text-gray-500 min-h-[300px] flex items-center justify-center">
        Add one or more legs to display the Strategy Payoff Diagram.
      </div>
    );
  }

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const priceVal = payload[0].payload?.price;
      const pnlCurrVal = payload[0].value;
      const pnlExpVal = payload[1]?.value ?? 0;
      return (
        <div className="bg-gray-950/90 border border-borderClr p-2.5 rounded-lg text-xs flex flex-col gap-1 shadow-lg">
          <span className="text-white font-extrabold">Asset Price: {priceVal != null ? priceVal.toLocaleString() : ""}</span>
          <span className="text-accentCyan">T+0 PnL: {pnlCurrVal != null ? (pnlCurrVal >= 0 ? "+" : "") + pnlCurrVal.toLocaleString() : "0"}</span>
          <span className="text-purple-400">Expiry PnL: {pnlExpVal != null ? (pnlExpVal >= 0 ? "+" : "") + pnlExpVal.toLocaleString() : "0"}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      {/* Chart Panel (Col Span 3) */}
      <div className="xl:col-span-3 flex flex-col gap-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Strategy Payoff Curve</h3>
          <div className="flex gap-4 text-[10px] text-gray-400 font-semibold">
            <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-accentCyan rounded-full" /> T+{daysPassed} PnL</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-purple-500 rounded-full" /> Expiry PnL</span>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 h-[350px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={payoff} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {/* Gradient for positive/negative PnL zones */}
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis
                type="number"
                dataKey="price"
                domain={['dataMin', 'dataMax']}
                stroke="#6B7280"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value != null && !isNaN(value) ? value.toLocaleString() : ""}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Crossover lines */}
              <ReferenceLine y={0} stroke="#4B5563" strokeWidth={1} />
              {spot != null && !isNaN(spot) && isFinite(spot) && (
                <ReferenceLine x={spot} stroke="#6366F1" strokeDasharray="3 3" label={{ value: 'Spot Price', fill: '#818CF8', fontSize: 10, position: 'top' }} />
              )}
              
              {/* Render break evens if any */}
              {metrics?.breakEvens.filter(be => be != null && !isNaN(be) && isFinite(be)).map((be) => (
                <ReferenceLine
                  key={be}
                  x={be}
                  stroke="#EAB308"
                  strokeWidth={1}
                  label={{ value: `BE: ${be}`, fill: '#F59E0B', fontSize: 9, position: 'bottom' }}
                />
              ))}

              <Area type="monotone" dataKey="pnlCurrent" stroke="#06B6D4" strokeWidth={2} fill="url(#colorProfit)" dot={false} name="Current PnL" />
              <Line type="monotone" dataKey="pnlExpiration" stroke="#A855F7" strokeWidth={2} dot={false} name="Expiry PnL" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sliders Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Date Slider */}
          <div className="glass-panel rounded-xl p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-semibold uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accentCyan" />
                Target Date (Theta Decay)
              </span>
              <span className="text-white font-bold">T+{daysPassed} Days / {totalDays}</span>
            </div>
            <input
              type="range"
              min={0}
              max={totalDays}
              value={daysPassed}
              onChange={(e) => setDaysPassed(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-accentCyan"
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Today (T+0)</span>
              <span>Expiration (T+{totalDays})</span>
            </div>
          </div>

          {/* Implied Volatility Slider */}
          <div className="glass-panel rounded-xl p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-semibold uppercase flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-greenBrand" />
                Implied Volatility (IV) Shift
              </span>
              <span className={`font-bold ${ivOffset > 0 ? "text-greenBrand" : ivOffset < 0 ? "text-redBrand" : "text-white"}`}>
                {ivOffset > 0 ? "+" : ""}{ivOffset}%
              </span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={ivOffset}
              onChange={(e) => setIvOffset(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-greenBrand"
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>-50% Vol Drop</span>
              <span>Neutral</span>
              <span>+50% Vol Spike</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Dashboard Side Panel (Col Span 1) */}
      {metrics && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider px-1">Strategy Performance</h3>
          
          <div className="glass-panel rounded-xl p-4 flex flex-col gap-4 flex-1">
            {/* Payoff Stats */}
            <div className="flex flex-col gap-2 border-b border-borderClr/30 pb-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Max Profit:</span>
                <span className={`font-bold ${metrics.maxProfit === "Unlimited" ? "text-greenBrand" : "text-white"}`}>
                  {typeof metrics.maxProfit === "number" && !isNaN(metrics.maxProfit) ? metrics.maxProfit.toLocaleString() : metrics.maxProfit}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Max Loss:</span>
                <span className="font-bold text-redBrand border-b border-dashed border-redBrand/20 cursor-help" title="Max Loss represents the worst case scenario at expiration.">
                  {typeof metrics.maxLoss === 'number' && !isNaN(metrics.maxLoss) ? metrics.maxLoss.toLocaleString() : metrics.maxLoss}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Risk:Reward Ratio:</span>
                <span className="font-bold text-white">{getRiskRewardRatio(metrics.maxProfit, metrics.maxLoss)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Prob. of Profit (POP):</span>
                <span className="font-bold text-accentCyan">{metrics.pop}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Margin Required:</span>
                <span className="font-bold text-yellow-500">{metrics.marginRequirement != null && !isNaN(metrics.marginRequirement) && metrics.marginRequirement > 0 ? metrics.marginRequirement.toLocaleString() : "0"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Debit / Credit:</span>
                <span className={`font-bold ${metrics.netDebitCredit >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                  {metrics.netDebitCredit != null && !isNaN(metrics.netDebitCredit) ? (metrics.netDebitCredit >= 0 ? "Credit: +" : "Debit: ") + Math.abs(metrics.netDebitCredit).toLocaleString() : "0"}
                </span>
              </div>
              <div className="flex justify-between items-start text-xs">
                <span className="text-gray-400">Break Evens:</span>
                <div className="flex flex-col items-end gap-0.5">
                  {metrics.breakEvens.length === 0 ? (
                    <span className="text-gray-500 text-[10px]">None detected</span>
                  ) : (
                    metrics.breakEvens.map((be) => (
                      <span key={be} className="text-yellow-400 font-semibold">{be != null && !isNaN(be) ? be.toLocaleString() : ""}</span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Position Greeks */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Aggregate Greeks</h4>
              
              {/* Delta */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  Delta (Δ)
                  <span className="group relative cursor-pointer text-gray-600 hover:text-gray-400">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="hidden group-hover:block absolute bg-gray-950 text-[10px] text-gray-300 w-36 p-1.5 rounded border border-borderClr bottom-5 left-0 z-50">
                      Portfolio share equivalents (rate of price change).
                    </span>
                  </span>
                </span>
                <span className="font-bold text-white">{metrics.delta.toFixed(2)}</span>
              </div>

              {/* Gamma */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  Gamma (Γ)
                  <span className="group relative cursor-pointer text-gray-600 hover:text-gray-400">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="hidden group-hover:block absolute bg-gray-950 text-[10px] text-gray-300 w-36 p-1.5 rounded border border-borderClr bottom-5 left-0 z-50">
                      Rate of change of Delta per $1 price change.
                    </span>
                  </span>
                </span>
                <span className="font-bold text-white">{metrics.gamma.toFixed(4)}</span>
              </div>

              {/* Vega */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  Vega (ν)
                  <span className="group relative cursor-pointer text-gray-600 hover:text-gray-400">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="hidden group-hover:block absolute bg-gray-950 text-[10px] text-gray-300 w-36 p-1.5 rounded border border-borderClr bottom-5 left-0 z-50">
                      PnL shift per 1% absolute IV change.
                    </span>
                  </span>
                </span>
                <span className={`font-bold ${metrics.vega >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                  {metrics.vega >= 0 ? "+" : ""}{metrics.vega.toFixed(2)}
                </span>
              </div>

              {/* Theta */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  Theta (θ)
                  <span className="group relative cursor-pointer text-gray-600 hover:text-gray-400">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="hidden group-hover:block absolute bg-gray-950 text-[10px] text-gray-300 w-36 p-1.5 rounded border border-borderClr bottom-5 left-0 z-50">
                      PnL decay per calendar day.
                    </span>
                  </span>
                </span>
                <span className={`font-bold ${metrics.theta >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                  {metrics.theta >= 0 ? "+" : ""}{metrics.theta.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
