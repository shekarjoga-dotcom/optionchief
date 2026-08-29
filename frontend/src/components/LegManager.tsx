import React, { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Trash2, Link as LinkIcon } from 'lucide-react';
import { getLotSizeForSymbol, getCurrencySymbol } from '../utils/optionsMath';
import { BACKEND_URL } from '../config';

export const LegManager: React.FC = () => {
  const { 
    legs, 
    removeLeg, 
    updateLeg, 
    clearLegs, 
    addLeg, 
    underlying, 
    selectedExpiry, 
    expiryDates,
    symbol, 
    options, 
    saveCurrentPortfolio, 
    fetchPortfolios, 
    user 
  } = useStore();

  const [saveName, setSaveName] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState<any>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [quickAddStrike, setQuickAddStrike] = useState<number | ''>('');
  const [quickAddExpiry, setQuickAddExpiry] = useState<string>('');

  const sortedStrikes = [...options].map(o => o.strike).sort((a, b) => a - b);
  const atmStrike = options.length > 0 && underlying?.spot
    ? options.reduce((prev, curr) =>
        Math.abs(curr.strike - underlying.spot) < Math.abs(prev.strike - underlying.spot) ? curr : prev
      ).strike
    : (underlying?.spot ? Math.round(underlying.spot / 50) * 50 : 24000);

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

  const handleExpiryChange = (id: string, newExpiry: string) => {
    updateLeg(id, { expiry: newExpiry });
  };

  const handleStrikeChange = (id: string, newStrike: number, optType: 'C' | 'P' | 'F') => {
    const row = options.find(o => o.strike === newStrike);
    const contract = optType === 'C' ? row?.CE : (optType === 'P' ? row?.PE : null);
    const price = contract?.lastPrice || (optType === 'F' ? (underlying?.spot || newStrike) : 5.0);
    const iv = contract?.impliedVolatility || 0.16;

    updateLeg(id, {
      strike: newStrike,
      entryPrice: price,
      currentPrice: price,
      iv: iv
    });
  };

  const handleOptionTypeChange = (id: string, newType: 'C' | 'P', currentStrike: number) => {
    const row = options.find(o => o.strike === currentStrike);
    const contract = newType === 'C' ? row?.CE : row?.PE;
    const price = contract?.lastPrice || 5.0;
    const iv = contract?.impliedVolatility || 0.16;

    updateLeg(id, {
      optionType: newType,
      entryPrice: price,
      currentPrice: price,
      iv: iv
    });
  };

  const handleAddFutureLeg = () => {
    if (!underlying) return;
    addCustomLeg('F', underlying.spot);
  };

  const addCustomLeg = (type: 'C' | 'P' | 'F', customStrike?: number) => {
    const strike = customStrike || (typeof quickAddStrike === 'number' && quickAddStrike > 0 ? quickAddStrike : atmStrike);
    const exp = quickAddExpiry || selectedExpiry || (expiryDates.length > 0 ? expiryDates[0] : new Date().toISOString().split('T')[0]);
    const defaultQty = getLotSizeForSymbol(symbol || underlying?.symbol || "");
    const row = options.find(o => o.strike === strike);
    const contract = type === 'C' ? row?.CE : (type === 'P' ? row?.PE : null);
    const price = contract?.lastPrice || (type === 'F' ? (underlying?.spot || strike) : 5.0);
    const iv = contract?.impliedVolatility || 0.16;

    addLeg({
      strike,
      optionType: type,
      expiry: exp,
      action: 'BUY',
      quantity: defaultQty,
      entryPrice: price,
      currentPrice: price,
      iv: iv
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

  const handleGenerateShareLink = async () => {
    if (legs.length === 0) {
      alert("Please add at least 1 leg to generate an entry link.");
      return;
    }
    setIsSharing(true);
    setCopied(false);
    try {
      const lotSize = getLotSizeForSymbol(symbol || "");
      const formattedLegs = legs.map(l => ({
        strike: l.strike,
        optionType: l.optionType,
        action: l.action,
        lots: Math.max(1, Math.round(l.quantity / lotSize)),
        entryPrice: l.entryPrice
      }));

      const response = await fetch(`${BACKEND_URL}/api/strategy/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol || underlying?.symbol || "NIFTY",
          expiry: selectedExpiry || "",
          strategyName: saveName.trim() || `${symbol || "NIFTY"} Strategy`,
          legs: formattedLegs,
          maxPayoff: 0.0,
          maxRisk: 0.0,
          margin: 0.0
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to generate entry link");
      }

      setShareData(data);
      setShareModalOpen(true);
    } catch (err: any) {
      alert(`Error generating entry link: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    if (shareData?.shareUrl) {
      navigator.clipboard.writeText(shareData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const loadPresetStrategy = (presetType: 'short_iron_condor' | 'long_iron_condor' | 'jade_lizard' | 'twisted_jade_lizard' | 'call_butterfly' | 'iron_butterfly') => {
    clearLegs();
    const spot = underlying?.spot || 24500;
    const roundSpot = Math.round(spot / 100) * 100;
    const defaultQty = getLotSizeForSymbol(symbol || underlying?.symbol || "");
    const exp = selectedExpiry || new Date().toISOString().split('T')[0];

    if (presetType === 'short_iron_condor') {
      addLeg({ strike: roundSpot - 200, optionType: 'P', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 70, currentPrice: 70, iv: 0.16 });
      addLeg({ strike: roundSpot - 300, optionType: 'P', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 40, currentPrice: 40, iv: 0.16 });
      addLeg({ strike: roundSpot + 200, optionType: 'C', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 70, currentPrice: 70, iv: 0.16 });
      addLeg({ strike: roundSpot + 300, optionType: 'C', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 40, currentPrice: 40, iv: 0.16 });
    } else if (presetType === 'long_iron_condor') {
      addLeg({ strike: roundSpot - 200, optionType: 'P', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 90, currentPrice: 90, iv: 0.16 });
      addLeg({ strike: roundSpot - 300, optionType: 'P', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 65, currentPrice: 65, iv: 0.16 });
      addLeg({ strike: roundSpot + 200, optionType: 'C', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 150, currentPrice: 150, iv: 0.16 });
      addLeg({ strike: roundSpot + 300, optionType: 'C', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 110, currentPrice: 110, iv: 0.16 });
    } else if (presetType === 'jade_lizard') {
      addLeg({ strike: roundSpot - 200, optionType: 'P', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 85, currentPrice: 85, iv: 0.16 });
      addLeg({ strike: roundSpot + 200, optionType: 'C', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 65, currentPrice: 65, iv: 0.16 });
      addLeg({ strike: roundSpot + 300, optionType: 'C', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 35, currentPrice: 35, iv: 0.16 });
    } else if (presetType === 'twisted_jade_lizard') {
      addLeg({ strike: roundSpot + 200, optionType: 'C', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 85, currentPrice: 85, iv: 0.16 });
      addLeg({ strike: roundSpot - 200, optionType: 'P', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 65, currentPrice: 65, iv: 0.16 });
      addLeg({ strike: roundSpot - 300, optionType: 'P', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 35, currentPrice: 35, iv: 0.16 });
    } else if (presetType === 'call_butterfly') {
      addLeg({ strike: roundSpot - 150, optionType: 'C', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 121, currentPrice: 121, iv: 0.16 });
      addLeg({ strike: roundSpot, optionType: 'C', expiry: exp, action: 'SELL', quantity: defaultQty * 2, entryPrice: 64, currentPrice: 64, iv: 0.16 });
      addLeg({ strike: roundSpot + 150, optionType: 'C', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 30, currentPrice: 30, iv: 0.16 });
    } else if (presetType === 'iron_butterfly') {
      addLeg({ strike: roundSpot, optionType: 'C', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 130, currentPrice: 130, iv: 0.16 });
      addLeg({ strike: roundSpot, optionType: 'P', expiry: exp, action: 'SELL', quantity: defaultQty, entryPrice: 130, currentPrice: 130, iv: 0.16 });
      addLeg({ strike: roundSpot + 200, optionType: 'C', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 40, currentPrice: 40, iv: 0.16 });
      addLeg({ strike: roundSpot - 200, optionType: 'P', expiry: exp, action: 'BUY', quantity: defaultQty, entryPrice: 40, currentPrice: 40, iv: 0.16 });
    }
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
        {/* Quick Presets Bar */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-borderClr/40">
          <span className="text-[10px] text-gray-400 font-extrabold uppercase">Quick Templates:</span>
          <button
            onClick={() => loadPresetStrategy('call_butterfly')}
            className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold transition-colors shadow-sm"
          >
            🦋 Long Call Butterfly
          </button>
          <button
            onClick={() => loadPresetStrategy('iron_butterfly')}
            className="px-2.5 py-1 rounded bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-400 text-xs font-bold transition-colors shadow-sm"
          >
            🦋 Iron Butterfly
          </button>
          <button
            onClick={() => loadPresetStrategy('short_iron_condor')}
            className="px-2.5 py-1 rounded bg-accentBrand/10 hover:bg-accentBrand/20 border border-accentBrand/30 text-accentBrand text-xs font-bold transition-colors"
          >
            ⚡ Short Iron Condor
          </button>
          <button
            onClick={() => loadPresetStrategy('long_iron_condor')}
            className="px-2.5 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold transition-colors"
          >
            ⚡ Long Iron Condor
          </button>
          <button
            onClick={() => loadPresetStrategy('jade_lizard')}
            className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition-colors"
          >
            ⚡ Jade Lizard (No Upside Risk)
          </button>
          <button
            onClick={() => loadPresetStrategy('twisted_jade_lizard')}
            className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-colors"
          >
            ⚡ Twisted Jade Lizard (No Downside Risk)
          </button>
        </div>

        {legs.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-500 flex flex-col items-center gap-2">
            <span>No active legs. Select a quick template above, use the Option Chain matrix, or add custom legs below.</span>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {expiryDates.length > 0 && (
                <select
                  value={quickAddExpiry || selectedExpiry}
                  onChange={(e) => setQuickAddExpiry(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-bold bg-gray-900 border border-borderClr text-accentCyan rounded-lg outline-none focus:border-accentCyan cursor-pointer"
                  title="Select Expiry"
                >
                  {expiryDates.map((exp) => (
                    <option key={exp} value={exp}>
                      Expiry: {exp}
                    </option>
                  ))}
                </select>
              )}
              {sortedStrikes.length > 0 && (
                <select
                  value={quickAddStrike}
                  onChange={(e) => setQuickAddStrike(e.target.value ? parseFloat(e.target.value) : '')}
                  className="px-2.5 py-1.5 text-xs font-bold bg-gray-900 border border-borderClr text-white rounded-lg outline-none focus:border-accentBrand cursor-pointer"
                >
                  <option value="">Select Strike (Default ATM {atmStrike})</option>
                  {sortedStrikes.map((s) => (
                    <option key={s} value={s}>
                      Strike: {s} {s === atmStrike ? "(ATM)" : ""}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => addCustomLeg('C')}
                className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold hover:bg-blue-500/30 transition-all"
              >
                + Add Call (CE)
              </button>
              <button
                onClick={() => addCustomLeg('P')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold hover:bg-amber-500/30 transition-all"
              >
                + Add Put (PE)
              </button>
              <button
                onClick={handleAddFutureLeg}
                className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold hover:bg-purple-500/30 transition-all"
              >
                + Add Long/Short Future
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Legs List */}
            <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
              {legs.map((leg) => {
                const isFuture = leg.optionType === 'F';
                return (
                  <div
                    key={leg.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-cardBgLight border border-borderClr/60 shadow-sm"
                  >
                    {/* Action, Strike, Type & Expiry */}
                    <div className="flex items-center gap-2">
                      <select
                        value={leg.action}
                        onChange={(e) => handleActionChange(leg.id, e.target.value as 'BUY' | 'SELL')}
                        className={`text-xs font-extrabold rounded px-2 py-1 outline-none border cursor-pointer ${
                          leg.action === 'BUY'
                            ? "bg-greenBrand/10 border-greenBrand/40 text-greenBrand"
                            : "bg-redBrand/10 border-redBrand/40 text-redBrand"
                        }`}
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>

                      {isFuture ? (
                        <span className="text-xs font-bold text-purple-300 uppercase tracking-wider bg-purple-500/15 border border-purple-500/30 px-2 py-1 rounded">
                          FUTURE (Spot: {underlying?.spot || leg.strike})
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {/* Strike Selector Dropdown */}
                          {sortedStrikes.length > 0 ? (
                            <select
                              value={leg.strike}
                              onChange={(e) => handleStrikeChange(leg.id, parseFloat(e.target.value), leg.optionType)}
                              className="text-xs font-extrabold rounded px-2.5 py-1 bg-gray-900 border border-borderClr text-white outline-none focus:border-accentBrand cursor-pointer"
                            >
                              {sortedStrikes.map((s) => (
                                <option key={s} value={s}>
                                  {s} {s === atmStrike ? "(ATM)" : ""}
                                </option>
                              ))}
                              {!sortedStrikes.includes(leg.strike) && (
                                <option value={leg.strike}>{leg.strike} (Custom)</option>
                              )}
                            </select>
                          ) : (
                            <input
                              type="number"
                              value={leg.strike}
                              onChange={(e) => handleStrikeChange(leg.id, parseFloat(e.target.value) || 0, leg.optionType)}
                              className="text-xs font-extrabold rounded px-2 py-1 bg-gray-900 border border-borderClr text-white w-24 outline-none focus:border-accentBrand"
                            />
                          )}

                          {/* Option Type Selector (CE / PE) */}
                          <select
                            value={leg.optionType}
                            onChange={(e) => handleOptionTypeChange(leg.id, e.target.value as 'C' | 'P', leg.strike)}
                            className={`text-xs font-extrabold rounded px-2 py-1 outline-none border cursor-pointer ${
                              leg.optionType === 'C'
                                ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                                : "bg-amber-500/15 border-amber-500/40 text-amber-300"
                            }`}
                          >
                            <option value="C">CE</option>
                            <option value="P">PE</option>
                          </select>

                          {/* Expiry Selector Dropdown */}
                          {expiryDates.length > 0 && (
                            <select
                              value={leg.expiry}
                              onChange={(e) => handleExpiryChange(leg.id, e.target.value)}
                              className="text-[11px] font-bold rounded px-2 py-1 bg-gray-900 border border-borderClr text-accentCyan outline-none focus:border-accentCyan cursor-pointer"
                              title="Contract Expiration Date"
                            >
                              {expiryDates.map((exp) => (
                                <option key={exp} value={exp}>
                                  {exp}
                                </option>
                              ))}
                              {!expiryDates.includes(leg.expiry) && leg.expiry && (
                                <option value={leg.expiry}>{leg.expiry}</option>
                              )}
                            </select>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inputs */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {/* Quantity */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">Qty</span>
                        <input
                          type="number"
                          value={leg.quantity}
                          onChange={(e) => handleQtyChange(leg.id, e.target.value)}
                          className="bg-gray-950 border border-borderClr rounded px-2 py-1 text-white w-20 focus:outline-none focus:border-accentBrand font-mono"
                        />
                      </div>

                      {/* Entry Price */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">Price</span>
                        <input
                          type="number"
                          step="0.05"
                          value={leg.entryPrice}
                          onChange={(e) => handlePriceChange(leg.id, e.target.value)}
                          className="bg-gray-950 border border-borderClr rounded px-2 py-1 text-white w-24 focus:outline-none focus:border-accentBrand font-mono"
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
                            className="bg-gray-950 border border-borderClr rounded px-2 py-1 text-white w-16 focus:outline-none focus:border-accentBrand font-mono"
                          />
                        </div>
                      )}
                    </div>

                    {/* Trash Action */}
                    <button
                      onClick={() => removeLeg(leg.id)}
                      className="text-gray-500 hover:text-redBrand p-1.5 rounded transition-all hover:bg-gray-900"
                      title="Remove Leg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick Add Custom Options inside manager */}
            <div className="flex flex-wrap gap-3 justify-between items-center border-t border-borderClr/30 pt-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Add Leg:</span>
                {expiryDates.length > 0 && (
                  <select
                    value={quickAddExpiry || selectedExpiry}
                    onChange={(e) => setQuickAddExpiry(e.target.value)}
                    className="px-2 py-1 text-xs font-bold bg-gray-900 border border-borderClr text-accentCyan rounded outline-none focus:border-accentCyan cursor-pointer"
                    title="Select Expiry for new leg"
                  >
                    {expiryDates.map((exp) => (
                      <option key={exp} value={exp}>
                        Exp: {exp}
                      </option>
                    ))}
                  </select>
                )}
                {sortedStrikes.length > 0 && (
                  <select
                    value={quickAddStrike}
                    onChange={(e) => setQuickAddStrike(e.target.value ? parseFloat(e.target.value) : '')}
                    className="px-2 py-1 text-xs font-bold bg-gray-900 border border-borderClr text-white rounded outline-none focus:border-accentBrand cursor-pointer"
                  >
                    <option value="">Strike: ATM ({atmStrike})</option>
                    {sortedStrikes.map((s) => (
                      <option key={s} value={s}>
                        Strike: {s} {s === atmStrike ? "(ATM)" : ""}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => addCustomLeg('C')}
                  className="px-2.5 py-1 border border-blue-500/40 text-blue-300 hover:bg-blue-500/20 rounded font-semibold transition-colors flex items-center gap-1"
                >
                  + Add Call (CE)
                </button>
                <button
                  onClick={() => addCustomLeg('P')}
                  className="px-2.5 py-1 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 rounded font-semibold transition-colors flex items-center gap-1"
                >
                  + Add Put (PE)
                </button>
                <button
                  onClick={handleAddFutureLeg}
                  className="px-2.5 py-1 border border-purple-500/40 text-purple-300 hover:bg-purple-500/20 rounded font-semibold transition-colors flex items-center gap-1"
                >
                  + Add Future
                </button>
              </div>

              {/* Save & Trade Form */}
              {user?.role !== 'viewer' && (
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Strategy Name (e.g. Iron Condor)..."
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-gray-950 border border-borderClr text-white placeholder-gray-600 focus:outline-none focus:border-accentBrand w-44"
                  />
                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 rounded bg-accentBrand hover:bg-accentBrand/90 text-white font-bold text-xs shadow-md"
                    title="Save Strategy Template"
                  >
                    Save Strategy
                  </button>
                  <button
                    onClick={handleGenerateShareLink}
                    disabled={isSharing}
                    className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(147,51,234,0.3)]"
                    title="Generate 1-Click Broker Entry Links (Dhan, Kite, Kotak)"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-purple-200" />
                    <span>{isSharing ? "Generating..." : "Entry Link"}</span>
                  </button>
                  <button
                    onClick={handleExecutePaperTrade}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                    title="Execute directly into Paper Trading Book"
                  >
                    <span>Execute Trade</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Share Modal */}
      {shareModalOpen && shareData && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel border border-borderClr bg-gray-950 rounded-xl max-w-lg w-full p-5 flex flex-col gap-4 text-left animate-scaleUp">
            <div className="flex justify-between items-center border-b border-borderClr/40 pb-2">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-purple-400" />
                1-Click Broker Order Execution Link
              </h3>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-gray-900 rounded-lg border border-borderClr/60 flex flex-col gap-2">
              <span className="text-xs text-gray-300 font-semibold">{shareData.strategyName}</span>
              <div className="flex flex-wrap gap-1.5">
                {shareData.legs.map((l: any, i: number) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-gray-950 border border-borderClr text-gray-300 font-mono">
                    {l.action} {l.strike} {l.optionType === 'C' ? 'CE' : (l.optionType === 'P' ? 'PE' : 'FUT')} ({l.lots} lot)
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-gray-400 font-semibold">Universal Web & Deep Link:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareData.shareUrl}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-xs text-purple-300 w-full font-mono select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-borderClr/40">
              <button
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
