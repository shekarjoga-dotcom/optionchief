import React, { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { getLotSizeForSymbol, getCurrencySymbol } from '../utils/optionsMath';
import { RefreshCw } from 'lucide-react';

export const OptionChainTable: React.FC = () => {
  const { options, underlying, addLeg, selectedExpiry, fetchMarketData } = useStore();

  const [refreshRate, setRefreshRate] = useState<number>(() => {
    const saved = localStorage.getItem("options_oracle_chain_refresh_rate");
    return saved ? parseInt(saved, 10) : 60; // default 60s
  });

  useEffect(() => {
    localStorage.setItem("options_oracle_chain_refresh_rate", refreshRate.toString());
  }, [refreshRate]);

  useEffect(() => {
    if (refreshRate === 0) return;

    const intervalId = setInterval(() => {
      fetchMarketData();
    }, refreshRate * 1000);

    return () => clearInterval(intervalId);
  }, [refreshRate, fetchMarketData, underlying?.symbol, selectedExpiry]);

  if (options.length === 0) {
    return (
      <div className="bg-cardBg rounded-xl p-8 border border-borderClr/40 text-center text-gray-500">
        No option chain data available. Select a symbol to fetch contracts.
      </div>
    );
  }

  const spot = underlying?.spot || 0;
  const cur = getCurrencySymbol(underlying?.symbol || "NIFTY");

  // Find the ATM strike closest to spot
  const atmStrike = options.reduce((prev, curr) => {
    return Math.abs(curr.strike - spot) < Math.abs(prev.strike - spot) ? curr : prev;
  }).strike;

  const formatPrice = (price: number) => {
    if (price === 0) return `${cur}0.00`;
    if (price < 1) return `${cur}${price.toFixed(3)}`;
    if (price < 10) return `${cur}${price.toFixed(2)}`;
    return `${cur}${price.toFixed(1)}`;
  };

  const formatQty = (qty: number) => {
    if (qty === 0) return "0";
    return qty.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    });
  };

  const handleAddLeg = (strike: number, optionType: 'C' | 'P', action: 'BUY' | 'SELL', price: number, iv: number) => {
    const defaultQty = getLotSizeForSymbol(underlying?.symbol || "");
    addLeg({
      strike,
      optionType,
      expiry: selectedExpiry,
      action,
      quantity: defaultQty,
      entryPrice: price,
      currentPrice: price,
      iv
    });
  };

  const getOIAnalysisBadge = (analysis?: string) => {
    if (!analysis || analysis === "Neutral") return null;
    
    let color = "text-gray-400 bg-gray-900 border-gray-800";
    if (analysis === "Long Buildup") color = "text-greenBrand bg-greenBrand/10 border-greenBrand/20";
    else if (analysis === "Short Buildup") color = "text-redBrand bg-redBrand/10 border-redBrand/20";
    else if (analysis === "Long Liquidation") color = "text-orange-400 bg-orange-400/10 border-orange-400/20";
    else if (analysis === "Short Covering") color = "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";

    return (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${color}`}>
        {analysis.split(" ")[0]}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Option Chain Matrix</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500 animate-fadeIn">
          <div className="flex items-center gap-2 bg-gray-900/80 border border-borderClr/40 px-2.5 py-1 rounded-lg">
            <RefreshCw 
              className={`w-3.5 h-3.5 text-accentCyan ${refreshRate > 0 ? "animate-spin" : ""}`} 
              style={{ animationDuration: refreshRate > 0 ? '6s' : '0s' }}
            />
            <span className="text-[11px] font-semibold text-gray-400">Auto-Refresh:</span>
            <select
              value={refreshRate}
              onChange={(e) => setRefreshRate(parseInt(e.target.value, 10))}
              className="bg-transparent text-white font-bold text-[11px] border-none focus:ring-0 focus:outline-none cursor-pointer pr-1"
            >
              <option value={0} className="bg-gray-950 text-white">Off</option>
              <option value={60} className="bg-gray-950 text-white">60s (Default)</option>
              <option value={120} className="bg-gray-950 text-white">2 Min</option>
              <option value={300} className="bg-gray-950 text-white">5 Min</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-accentBrand/10 border border-accentBrand/30 block rounded-sm" />
            <span>ATM Strike</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-borderClr/40 bg-cardBg max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            {/* Super header */}
            <tr className="border-b border-borderClr/60 bg-gray-950 text-gray-400 uppercase tracking-widest text-[10px]">
              <th colSpan={7} className="text-center py-2 border-r border-borderClr/60">Call Options (CE)</th>
              <th className="text-center py-2 bg-gray-900">Strike</th>
              <th colSpan={7} className="text-center py-2 border-l border-borderClr/60">Put Options (PE)</th>
            </tr>
            {/* Header Columns */}
            <tr className="border-b border-borderClr bg-gray-900 text-gray-400 font-bold text-center">
              {/* CE */}
              <th className="py-2.5 px-1.5">Delta</th>
              <th className="py-2.5 px-1.5">
                <div className="flex flex-col">
                  <span>Bid Qty</span>
                  <span className="text-[9px] font-normal text-gray-500">{underlying?.symbol || "NIFTY"}</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5 text-redBrand font-bold">
                <div className="flex flex-col">
                  <span>Bid</span>
                  <span className="text-[9px] font-normal text-gray-500">(Price / IV)</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5">
                <div className="flex flex-col">
                  <span>Mark</span>
                  <span className="text-[9px] font-normal text-gray-500">(Price / IV)</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5 text-greenBrand font-bold">
                <div className="flex flex-col">
                  <span>Ask</span>
                  <span className="text-[9px] font-normal text-gray-500">(Price / IV)</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5">
                <div className="flex flex-col">
                  <span>Ask Qty</span>
                  <span className="text-[9px] font-normal text-gray-500">{underlying?.symbol || "NIFTY"}</span>
                </div>
              </th>
              <th className="py-2.5 px-2 border-r border-borderClr/60">OI</th>
              
              {/* Strike */}
              <th className="py-2.5 px-3 bg-gray-950 font-extrabold text-white">
                <div className="flex items-center justify-center gap-1">
                  <span>Strike</span>
                  <span className="text-orange-400 text-[10px]">▲</span>
                </div>
              </th>
              
              {/* PE */}
              <th className="py-2.5 px-2 border-l border-borderClr/60">OI</th>
              <th className="py-2.5 px-1.5">
                <div className="flex flex-col">
                  <span>Bid Qty</span>
                  <span className="text-[9px] font-normal text-gray-500">{underlying?.symbol || "NIFTY"}</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5 text-redBrand font-bold">
                <div className="flex flex-col">
                  <span>Bid</span>
                  <span className="text-[9px] font-normal text-gray-500">(Price / IV)</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5">
                <div className="flex flex-col">
                  <span>Mark</span>
                  <span className="text-[9px] font-normal text-gray-500">(Price / IV)</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5 text-greenBrand font-bold">
                <div className="flex flex-col">
                  <span>Ask</span>
                  <span className="text-[9px] font-normal text-gray-500">(Price / IV)</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5">
                <div className="flex flex-col">
                  <span>Ask Qty</span>
                  <span className="text-[9px] font-normal text-gray-500">{underlying?.symbol || "NIFTY"}</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5">Delta</th>
            </tr>
          </thead>
          <tbody>
            {options.map((row) => {
              const ce = row.CE;
              const pe = row.PE;
              const strike = row.strike;
              const isATM = strike === atmStrike;

              return (
                <tr
                  key={strike}
                  className={`border-b border-borderClr/20 transition-all hover:bg-gray-800/40 ${
                    isATM ? "bg-accentBrand/5" : ""
                  }`}
                >
                  {/* CALLS */}
                  {ce ? (
                    <>
                      {/* Delta */}
                      <td className="py-2 px-1.5 text-center text-gray-400">{ce.delta !== undefined ? ce.delta.toFixed(3) : "0.000"}</td>
                      
                      {/* Bid Qty */}
                      <td className="py-2 px-1.5 text-center text-gray-500">{formatQty(ce.bidQty || 0)}</td>
                      
                      {/* Bid (Price / IV) - Click to Sell */}
                      <td 
                        onClick={() => handleAddLeg(strike, 'C', 'SELL', ce.bid || ce.lastPrice, ce.bidIv || ce.impliedVolatility)}
                        className="py-2 px-1.5 text-center cursor-pointer hover:bg-redBrand/10 transition-colors border border-transparent hover:border-redBrand/30 rounded"
                        title="Click to Sell Call"
                      >
                        <div className="flex flex-col">
                          <span className="font-extrabold text-redBrand">{formatPrice(ce.bid || ce.lastPrice)}</span>
                          <span className="text-[10px] text-gray-500">{(ce.bidIv !== undefined ? ce.bidIv * 100 : ce.impliedVolatility * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      
                      {/* Mark (Price / IV) */}
                      <td className="py-2 px-1.5 text-center bg-gray-950/20">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-white">{formatPrice(ce.lastPrice)}</span>
                          <span className="text-[10px] text-gray-500">{(ce.impliedVolatility * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      
                      {/* Ask (Price / IV) - Click to Buy */}
                      <td 
                        onClick={() => handleAddLeg(strike, 'C', 'BUY', ce.ask || ce.lastPrice, ce.askIv || ce.impliedVolatility)}
                        className="py-2 px-1.5 text-center cursor-pointer hover:bg-greenBrand/10 transition-colors border border-transparent hover:border-greenBrand/30 rounded"
                        title="Click to Buy Call"
                      >
                        <div className="flex flex-col">
                          <span className="font-extrabold text-greenBrand">{formatPrice(ce.ask || ce.lastPrice)}</span>
                          <span className="text-[10px] text-gray-500">{(ce.askIv !== undefined ? ce.askIv * 100 : ce.impliedVolatility * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      
                      {/* Ask Qty */}
                      <td className="py-2 px-1.5 text-center text-gray-500">{formatQty(ce.askQty || 0)}</td>
                      
                      {/* OI */}
                      <td className="py-2 px-2 text-center text-gray-300 font-semibold border-r border-borderClr/60">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{ce.openInterest.toLocaleString()}</span>
                          {getOIAnalysisBadge(ce.oiAnalysis)}
                        </div>
                      </td>
                    </>
                  ) : (
                    <td colSpan={7} className="text-center text-gray-600 border-r border-borderClr/60">No CE contracts</td>
                  )}

                  {/* STRIKE PRICE */}
                  <td className={`py-2 px-3 text-center font-extrabold ${isATM ? "text-accentCyan bg-accentCyan/10 border-x border-accentCyan/20" : "text-white bg-gray-900/60"}`}>
                    {strike.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </td>

                  {/* PUTS */}
                  {pe ? (
                    <>
                      {/* OI */}
                      <td className="py-2 px-2 text-center text-gray-300 font-semibold border-l border-borderClr/60">
                        <div className="flex items-center justify-center gap-1.5">
                          {getOIAnalysisBadge(pe.oiAnalysis)}
                          <span>{pe.openInterest.toLocaleString()}</span>
                        </div>
                      </td>
                      
                      {/* Bid Qty */}
                      <td className="py-2 px-1.5 text-center text-gray-500">{formatQty(pe.bidQty || 0)}</td>
                      
                      {/* Bid (Price / IV) - Click to Sell */}
                      <td 
                        onClick={() => handleAddLeg(strike, 'P', 'SELL', pe.bid || pe.lastPrice, pe.bidIv || pe.impliedVolatility)}
                        className="py-2 px-1.5 text-center cursor-pointer hover:bg-redBrand/10 transition-colors border border-transparent hover:border-redBrand/30 rounded"
                        title="Click to Sell Put"
                      >
                        <div className="flex flex-col">
                          <span className="font-extrabold text-redBrand">{formatPrice(pe.bid || pe.lastPrice)}</span>
                          <span className="text-[10px] text-gray-500">{(pe.bidIv !== undefined ? pe.bidIv * 100 : pe.impliedVolatility * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      
                      {/* Mark (Price / IV) */}
                      <td className="py-2 px-1.5 text-center bg-gray-950/20">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-white">{formatPrice(pe.lastPrice)}</span>
                          <span className="text-[10px] text-gray-500">{(pe.impliedVolatility * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      
                      {/* Ask (Price / IV) - Click to Buy */}
                      <td 
                        onClick={() => handleAddLeg(strike, 'P', 'BUY', pe.ask || pe.lastPrice, pe.askIv || pe.impliedVolatility)}
                        className="py-2 px-1.5 text-center cursor-pointer hover:bg-greenBrand/10 transition-colors border border-transparent hover:border-greenBrand/30 rounded"
                        title="Click to Buy Put"
                      >
                        <div className="flex flex-col">
                          <span className="font-extrabold text-greenBrand">{formatPrice(pe.ask || pe.lastPrice)}</span>
                          <span className="text-[10px] text-gray-500">{(pe.askIv !== undefined ? pe.askIv * 100 : pe.impliedVolatility * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      
                      {/* Ask Qty */}
                      <td className="py-2 px-1.5 text-center text-gray-500">{formatQty(pe.askQty || 0)}</td>
                      
                      {/* Delta */}
                      <td className="py-2 px-1.5 text-center text-gray-400">{pe.delta !== undefined ? pe.delta.toFixed(3) : "0.000"}</td>
                    </>
                  ) : (
                    <td colSpan={7} className="text-center text-gray-600 border-l border-borderClr/60">No PE contracts</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
