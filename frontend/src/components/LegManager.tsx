import React, { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Trash2, Coins, Link as LinkIcon } from 'lucide-react';
import { getLotSizeForSymbol, getCurrencySymbol } from '../utils/optionsMath';
import { BACKEND_URL } from '../config';

export const LegManager: React.FC = () => {
  const { legs, removeLeg, updateLeg, clearLegs, underlying, selectedExpiry, symbol, saveCurrentPortfolio, fetchPortfolios, user } = useStore();
  const [saveName, setSaveName] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState<any>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

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
                    className="px-3 py-1.5 rounded bg-accentBrand hover:bg-accentBrand/90 text-white font-bold text-xs"
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
                    className="px-3 py-1.5 rounded bg-greenBrand hover:bg-greenBrand/90 text-black font-extrabold flex items-center gap-1 transition-all text-xs"
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

      {/* 1-Click Broker Entry Link & Share Strategy Modal */}
      {shareModalOpen && shareData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-gray-900 border border-gray-700/80 rounded-xl p-6 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setShareModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-4">
              <LinkIcon className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider">Strategy Entry Link & Broker Basket</h3>
            </div>

            {/* Payoff & Risk Summary */}
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 mb-4 text-xs space-y-1.5">
              <div className="text-gray-300 font-bold mb-1">
                {symbol || underlying?.symbol || "NIFTY"} Strategy Summary:
              </div>
              {legs.map((l, i) => (
                <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${l.action === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className="font-bold text-white">{l.action} {l.quantity / getLotSizeForSymbol(symbol || "")} LOT</span>
                  <span className="text-gray-400">{l.strike} {l.optionType === 'F' ? 'FUT' : l.optionType === 'C' ? 'CE' : 'PE'} @ {getCurrencySymbol(symbol)}{l.entryPrice}</span>
                </div>
              ))}
            </div>

            {/* Short Strategy Entry Link */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-purple-300 mb-1">Strategy Share Link:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareData.shareUrl}
                  className="bg-gray-950 border border-purple-800/60 rounded px-3 py-1.5 text-xs text-white w-full font-mono select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                    copied ? "bg-emerald-600 text-white" : "bg-purple-600 hover:bg-purple-500 text-white"
                  }`}
                >
                  {copied ? "Copied! ✓" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* 1-Click Broker Execution Deep Links */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">1-Click Broker Entry Links:</div>
              
              {/* Dhan Web 1-Click Link */}
              <a
                href={shareData.brokerLinks.dhanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-700/60 text-emerald-300 p-3 rounded-lg font-bold text-xs transition-all shadow-md group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Execute on Dhan HQ Web App (web.dhan.co)</span>
                </div>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>

              {/* Zerodha Kite 1-Click Link */}
              <a
                href={shareData.brokerLinks.kiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-cyan-950/80 hover:bg-cyan-900/90 border border-cyan-700/60 text-cyan-300 p-3 rounded-lg font-bold text-xs transition-all shadow-md group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>Execute on Zerodha Kite (1-Click Basket)</span>
                </div>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>

              {/* Kotak Neo 1-Click Link */}
              <a
                href={shareData.brokerLinks.kotakUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-red-950/80 hover:bg-red-900/90 border border-red-700/60 text-red-300 p-3 rounded-lg font-bold text-xs transition-all shadow-md group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span>Execute on Kotak Neo Web App (neo.kotaksecurities.com)</span>
                </div>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
            </div>

            <div className="mt-5 text-[10px] text-gray-500 text-center">
              Educational Disclaimer: Review position risks and broker margin requirements before execution.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
