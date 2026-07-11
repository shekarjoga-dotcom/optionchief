import React, { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Trash2, Coins } from 'lucide-react';
import { getLotSizeForSymbol, getCurrencySymbol } from '../utils/optionsMath';

export const LegManager: React.FC = () => {
  const { legs, removeLeg, updateLeg, clearLegs, underlying, selectedExpiry, symbol, saveCurrentPortfolio, fetchPortfolios, user } = useStore();
  const [saveName, setSaveName] = useState("");

  const handleQtyChange = (id: string, qtyStr: string) => {
    const qty = parseInt(qtyStr) || 0;
    updateLeg(id, { quantity: qty });
  };

  const handlePriceChange = (id: string, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    updateLeg(id, { entryPrice: val, currentPrice: val });
  };

  const handleIvChange = (id: string, valStr: string) => {
    const val = (parseFloat(valStr) || 0) / 100.0;
    updateLeg(id, { iv: val });
  };

  const handleActionChange = (id: string, action: 'BUY' | 'SELL') => {
    updateLeg(id, { action });
  };

  const handleAddFutureLeg = () => {
    if (!underlying) return;
    addCustomLeg('F', underlying.spot);
  };

  const { addLeg } = useStore();
  const addCustomLeg = (type: 'C' | 'P' | 'F', defaultStrike = 0) => {
    const spot = underlying?.spot || 100;
    const strike = defaultStrike || spot;
    const defaultQty = getLotSizeForSymbol(symbol || underlying?.symbol || "");
    addLeg({
      strike,
      optionType: type,
      expiry: selectedExpiry || new Date().toISOString().split('T')[0],
      action: 'BUY',
      quantity: defaultQty,
      entryPrice: type === 'F' ? spot : 5.0,
      currentPrice: type === 'F' ? spot : 5.0,
      iv: 0.16
    });
  };

  const handleSave = () => {
    if (!saveName.trim()) {
      alert("Please enter a name for the strategy.");
      return;
    }
    saveCurrentPortfolio(saveName);
    setSaveName("");
    alert("Strategy saved successfully!");
  };

  const handleExecutePaperTrade = async () => {
    if (legs.length === 0) {
      alert("Please add legs to execute a trade.");
      return;
    }
    const tradeName = saveName.trim() || `Paper: ${symbol || "Custom"} Strategy`;
    const cur = getCurrencySymbol(symbol);
    const desc = `Custom entry at spot ${cur}${underlying?.spot.toLocaleString() || "N/A"}`;
    await saveCurrentPortfolio(tradeName, desc);
    await fetchPortfolios();
    setSaveName("");
    alert(`Executed Paper Trade for "${tradeName}"! Added to Paper Trading Book.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center px-1">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Strategy Legs</h3>
          <p className="text-[10px] text-gray-500">Configure position legs to analyze strategy payoff profile.</p>
        </div>
        {legs.length > 0 && (
          <button
            onClick={clearLegs}
            className="text-xs text-redBrand font-semibold hover:underline flex items-center gap-1"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="glass-panel rounded-xl p-4 flex flex-col gap-4">
        {legs.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-500 flex flex-col items-center gap-2">
            <span>No active legs. Use the Option Chain matrix above to add legs, or add custom legs below.</span>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => addCustomLeg('C')}
                className="px-2.5 py-1.5 rounded bg-gray-900 border border-borderClr hover:bg-gray-800 text-white font-semibold"
              >
                + Add Custom Option
              </button>
              <button
                onClick={handleAddFutureLeg}
                className="px-2.5 py-1.5 rounded bg-gray-900 border border-borderClr hover:bg-gray-800 text-white font-semibold"
              >
                + Add Long/Short Future
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Legs List */}
            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
              {legs.map((leg) => {
                const isFuture = leg.optionType === 'F';
                return (
                  <div
                    key={leg.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-cardBgLight border border-borderClr/60"
                  >
                    {/* Action & Type */}
                    <div className="flex items-center gap-2">
                      <select
                        value={leg.action}
                        onChange={(e) => handleActionChange(leg.id, e.target.value as 'BUY' | 'SELL')}
                        className={`text-xs font-extrabold rounded px-2 py-1 outline-none border ${
                          leg.action === 'BUY'
                            ? "bg-greenBrand/10 border-greenBrand/40 text-greenBrand"
                            : "bg-redBrand/10 border-redBrand/40 text-redBrand"
                        }`}
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>

                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {isFuture ? "Future" : `${leg.strike} ${leg.optionType === 'C' ? 'CE' : 'PE'}`}
                      </span>
                    </div>

                    {/* Inputs */}
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      {/* Quantity */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">Qty</span>
                        <input
                          type="number"
                          value={leg.quantity}
                          onChange={(e) => handleQtyChange(leg.id, e.target.value)}
                          className="bg-gray-950 border border-borderClr rounded px-2 py-1 text-white w-20 focus:outline-none focus:border-accentBrand"
                        />
                      </div>

                      {/* Entry Price */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">Entry Price</span>
                        <input
                          type="number"
                          step="0.05"
                          value={leg.entryPrice}
                          onChange={(e) => handlePriceChange(leg.id, e.target.value)}
                          className="bg-gray-950 border border-borderClr rounded px-2 py-1 text-white w-24 focus:outline-none focus:border-accentBrand"
                        />
                      </div>

                      {/* IV Override (Options Only) */}
                      {!isFuture && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-500 font-semibold uppercase">IV (%)</span>
                          <input
                            type="number"
                            step="0.1"
                            value={Math.round(leg.iv * 1000) / 10}
                            onChange={(e) => handleIvChange(leg.id, e.target.value)}
                            className="bg-gray-950 border border-borderClr rounded px-2 py-1 text-white w-16 focus:outline-none focus:border-accentBrand"
                          />
                        </div>
                      )}
                    </div>

                    {/* Trash Action */}
                    <button
                      onClick={() => removeLeg(leg.id)}
                      className="text-gray-500 hover:text-redBrand p-1.5 rounded transition-all hover:bg-gray-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick Add Custom Options inside manager */}
            <div className="flex flex-wrap gap-2 justify-between items-center border-t border-borderClr/30 pt-3 text-xs">
              <div className="flex gap-2">
                <button
                  onClick={() => addCustomLeg('C')}
                  className="px-2 py-1 border border-borderClr text-gray-300 hover:text-white rounded hover:bg-gray-800"
                >
                  + Add Custom Call (CE)
                </button>
                <button
                  onClick={() => addCustomLeg('P')}
                  className="px-2 py-1 border border-borderClr text-gray-300 hover:text-white rounded hover:bg-gray-800"
                >
                  + Add Custom Put (PE)
                </button>
                <button
                  onClick={handleAddFutureLeg}
                  className="px-2 py-1 border border-borderClr text-gray-300 hover:text-white rounded hover:bg-gray-800"
                >
                  + Add Future Leg
                </button>
              </div>

              {/* Save & Trade Form */}
              {user?.role !== 'viewer' && (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Strategy Name (e.g. Iron Condor)..."
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-gray-950 border border-borderClr text-white placeholder-gray-600 focus:outline-none focus:border-accentBrand w-48"
                  />
                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 rounded bg-accentBrand hover:bg-accentBrand/90 text-white font-bold"
                    title="Save Strategy Template"
                  >
                    Save Strategy
                  </button>
                  <button
                    onClick={handleExecutePaperTrade}
                    className="px-3 py-1.5 rounded bg-greenBrand hover:bg-greenBrand/90 text-black font-extrabold flex items-center gap-1 transition-all"
                    title="Execute Paper Trade"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Execute Trade</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
