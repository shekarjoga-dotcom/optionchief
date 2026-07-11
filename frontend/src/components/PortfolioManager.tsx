import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { Briefcase, Play, Trash2, XCircle, Clock, Coins, TrendingUp } from 'lucide-react';
import type { SavedPortfolio, StrategyLeg, TriggeredAlert } from '../types';
import { projectStrategy, projectLegPnL, getLotSizeForSymbol, normalizeLegQuantities, getCurrencySymbol } from '../utils/optionsMath';
import { PayoffChart } from './PayoffChart';

import { BACKEND_URL } from '../config';

export const PortfolioManager: React.FC = () => {
  const { portfolios, fetchPortfolios, loadLegs, deletePortfolio, setSymbol, symbol, underlying, user, updatePortfolio, squareOffPortfolio, triggeredAlerts, fetchTriggeredAlerts, clearTriggeredAlerts, deleteTriggeredAlert } = useStore();
  const [viewMode, setViewMode] = useState<'open' | 'closed' | 'alerts'>('open');
  const [tempTakeProfit, setTempTakeProfit] = useState<Record<string, number>>({});
  const [tempStopLoss, setTempStopLoss] = useState<Record<string, number>>({});
  const [alertSpotPrices, setAlertSpotPrices] = useState<Record<string, number>>({});

  // Sorting states
  const [openSortKey, setOpenSortKey] = useState<string>("date");
  const [openSortOrder, setOpenSortOrder] = useState<"asc" | "desc">("desc");

  const [closedSortKey, setClosedSortKey] = useState<string>("date");
  const [closedSortOrder, setClosedSortOrder] = useState<"asc" | "desc">("desc");

  const [alertSortKey, setAlertSortKey] = useState<string>("time");
  const [alertSortOrder, setAlertSortOrder] = useState<"asc" | "desc">("desc");

  // Payoff and Execution Modals state
  const [payoffModalOpen, setPayoffModalOpen] = useState(false);
  const [payoffModalData, setPayoffModalData] = useState<{
    legs: any[];
    spot: number;
    expiry: string;
    symbol: string;
    name: string;
  } | null>(null);

  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [executeModalData, setExecuteModalData] = useState<{
    legs: any[];
    symbol: string;
    strategyName: string;
    description: string;
  } | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<'paper' | 'dhan' | 'kotak'>('paper');
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);

  const handleExecuteTrade = async () => {
    if (!executeModalData) return;
    setIsExecutingTrade(true);
    const token = localStorage.getItem("options_oracle_token");
    try {
      const response = await fetch(`${BACKEND_URL}/api/portfolio/execute`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          broker: selectedBroker,
          name: executeModalData.strategyName,
          symbol: executeModalData.symbol,
          description: executeModalData.description || `Executed via auto-scanner alert`,
          legs: executeModalData.legs
        })
      });
      const data = await response.json();
      if (response.ok && data.status === "success") {
        let msg = `Successfully executed strategy on ${selectedBroker.toUpperCase()}!\n`;
        if (data.orders && data.orders.length > 0) {
          data.orders.forEach((o: any) => {
            msg += `\nLeg ${o.strike} ${o.type} (${o.action}): ${o.status} - ${o.message}`;
          });
        }
        alert(msg);
        setExecuteModalOpen(false);
        fetchPortfolios(); // refresh list
      } else {
        alert(`Order Execution failed: ${data.detail || "Server error"}`);
      }
    } catch (err: any) {
      console.error("Trade execution failed", err);
      alert(`Trade execution failed: ${err.message || "Network error"}`);
    } finally {
      setIsExecutingTrade(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchSpotPrices = async () => {
      const uniqueSymbols = Array.from(new Set([
        ...triggeredAlerts.map(t => t.symbol.toUpperCase()),
        ...portfolios.map(p => p.symbol.toUpperCase())
      ]));
      if (uniqueSymbols.length === 0) return;

      const prices: Record<string, number> = {};
      await Promise.all(
        uniqueSymbols.map(async (sym) => {
          try {
            if (sym === symbol.toUpperCase() && underlying?.spot) {
              prices[sym] = underlying.spot;
              return;
            }
            const res = await fetch(`${BACKEND_URL}/api/market/underlying?symbol=${sym}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.spot) {
                prices[sym] = data.spot;
              }
            }
          } catch (err) {
            console.error("Failed to fetch spot price for", sym, err);
          }
        })
      );

      if (isMounted) {
        setAlertSpotPrices(prev => ({ ...prev, ...prices }));
      }
    };

    fetchSpotPrices();
    const interval = setInterval(fetchSpotPrices, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [triggeredAlerts, portfolios, symbol, underlying]);

  const getAlertCurrentPnL = (trig: TriggeredAlert) => {
    const activeSpot = alertSpotPrices[trig.symbol.toUpperCase()] || trig.spotPrice || (trig.legs[0]?.strike || 100);

    let totalPnL = 0;
    for (const leg of trig.legs) {
      const pnlData = projectLegPnL(leg, activeSpot, 0, 0);
      totalPnL += pnlData.pnl;
    }
    return Math.round(totalPnL * 100) / 100;
  };

  const handleClearAllAlerts = () => {
    if (confirm("Are you sure you want to clear all triggered alerts?")) {
      clearTriggeredAlerts();
    }
  };

  useEffect(() => {
    fetchTriggeredAlerts();
    const timer = setInterval(fetchTriggeredAlerts, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLoadAlert = (trig: TriggeredAlert) => {
    setSymbol(trig.symbol);
    loadLegs(normalizeLegQuantities(trig.legs, trig.symbol));
    alert(`Loaded strategy: ${trig.strategyName} (${trig.symbol})`);
  };

  const handleDeleteAlert = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this alert record?")) {
      deleteTriggeredAlert(id);
    }
  };

  const handleTakeProfitChange = async (p: SavedPortfolio, val: number) => {
    p.takeProfit = val;
    await updatePortfolio(p);
  };

  const handleStopLossChange = async (p: SavedPortfolio, val: number) => {
    p.stopLoss = val;
    await updatePortfolio(p);
  };



  const formatLegsCompact = (legs: StrategyLeg[], symbol: string) => {
    const lotSize = getLotSizeForSymbol(symbol);
    return legs.map(leg => {
      const sign = leg.action === 'BUY' ? '+' : '-';
      const multiplier = Math.round(leg.quantity / lotSize);
      const typeChar = leg.optionType === 'C' ? 'C' : leg.optionType === 'P' ? 'P' : 'F';
      return `${sign}${multiplier}x${typeChar}${leg.strike}`;
    }).join(' / ');
  };

  useEffect(() => {
    fetchPortfolios();
  }, []);

  // Classify portfolios into open and closed positions
  const { open: openPositions, closed: closedHistory } = useMemo(() => {
    const open: SavedPortfolio[] = [];
    const closed: SavedPortfolio[] = [];

    portfolios.forEach((p) => {
      // If portfolio has realizedPnL or status is squared off in legs, it is closed
      const isClosed = (p.realizedPnL ?? 0) !== 0 || p.legs.some(l => l.status === "SQUARED_OFF");
      if (isClosed) {
        closed.push(p);
      } else {
        open.push(p);
      }
    });

    return { open, closed };
  }, [portfolios]);

  const sortedOpenPositions = useMemo(() => {
    const copy = [...openPositions];
    copy.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";
      
      if (openSortKey === "symbol") {
        valA = a.symbol.toUpperCase();
        valB = b.symbol.toUpperCase();
      } else if (openSortKey === "name") {
        valA = a.name.toUpperCase();
        valB = b.name.toUpperCase();
      } else if (openSortKey === "date") {
        valA = a.createdAt || "";
        valB = b.createdAt || "";
      } else if (openSortKey === "pnl") {
        valA = getPortfolioStats(a).unrealizedPnL;
        valB = getPortfolioStats(b).unrealizedPnL;
      } else if (openSortKey === "maxProfit") {
        const mA = getPortfolioStats(a).metrics.maxProfit;
        const mB = getPortfolioStats(b).metrics.maxProfit;
        valA = typeof mA === 'number' ? mA : 9999999;
        valB = typeof mB === 'number' ? mB : 9999999;
      } else if (openSortKey === "maxLoss") {
        const mA = getPortfolioStats(a).metrics.maxLoss;
        const mB = getPortfolioStats(b).metrics.maxLoss;
        valA = typeof mA === 'number' ? mA : 9999999;
        valB = typeof mB === 'number' ? mB : 9999999;
      }
      
      if (valA < valB) return openSortOrder === "asc" ? -1 : 1;
      if (valA > valB) return openSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [openPositions, openSortKey, openSortOrder]);

  const sortedClosedHistory = useMemo(() => {
    const copy = [...closedHistory];
    copy.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";
      
      if (closedSortKey === "symbol") {
        valA = a.symbol.toUpperCase();
        valB = b.symbol.toUpperCase();
      } else if (closedSortKey === "name") {
        valA = a.name.toUpperCase();
        valB = b.name.toUpperCase();
      } else if (closedSortKey === "date") {
        valA = a.createdAt || "";
        valB = b.createdAt || "";
      } else if (closedSortKey === "pnl") {
        valA = a.realizedPnL ?? 0;
        valB = b.realizedPnL ?? 0;
      }
      
      if (valA < valB) return closedSortOrder === "asc" ? -1 : 1;
      if (valA > valB) return closedSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [closedHistory, closedSortKey, closedSortOrder]);

  const sortedTriggeredAlerts = useMemo(() => {
    const copy = [...triggeredAlerts];
    copy.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";
      
      if (alertSortKey === "symbol") {
        valA = a.symbol.toUpperCase();
        valB = b.symbol.toUpperCase();
      } else if (alertSortKey === "name") {
        valA = a.strategyName.toUpperCase();
        valB = b.strategyName.toUpperCase();
      } else if (alertSortKey === "time") {
        valA = a.timestamp || "";
        valB = b.timestamp || "";
      } else if (alertSortKey === "pnl") {
        valA = getAlertCurrentPnL(a);
        valB = getAlertCurrentPnL(b);
      } else if (alertSortKey === "maxLoss") {
        const parseVal = (v: string | number) => {
          const str = String(v);
          if (str.toLowerCase().includes("unlimited")) return 9999999;
          return parseFloat(str.replace(/[^0-9.-]/g, "")) || 0;
        };
        valA = parseVal(a.maxLoss);
        valB = parseVal(b.maxLoss);
      }
      
      if (valA < valB) return alertSortOrder === "asc" ? -1 : 1;
      if (valA > valB) return alertSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [triggeredAlerts, alertSortKey, alertSortOrder]);

  const renderSortHeader = (
    label: string, 
    key: string, 
    currentKey: string, 
    order: "asc" | "desc", 
    setKey: (k: any) => void, 
    setOrder: (o: any) => void
  ) => {
    const isSelected = currentKey === key;
    return (
      <th 
        onClick={() => {
          if (isSelected) {
            setOrder(order === "asc" ? "desc" : "asc");
          } else {
            setKey(key);
            setOrder("desc");
          }
        }}
        className="py-3 px-3 cursor-pointer hover:bg-gray-800 transition-colors select-none text-left"
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          <span className="text-[9px] text-gray-500 font-normal">
            {isSelected ? (order === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </div>
      </th>
    );
  };

  const handleLoad = (p: SavedPortfolio) => {
    setSymbol(p.symbol);
    loadLegs(p.legs);
    alert(`Loaded strategy: ${p.name} (${p.symbol})`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this trade record?")) {
      await deletePortfolio(id);
    }
  };

  const handleSquareOff = async (p: SavedPortfolio, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to square off ${p.name}?`)) return;

    // Calculate current live unrealized MTM to lock in as realized PnL
    const stats = getPortfolioStats(p);
    const realizedPnL = stats.unrealizedPnL;
    const curSym = getCurrencySymbol(p.symbol);

    await squareOffPortfolio(p.id, realizedPnL);
    alert(`Position squared off! Realized PnL: ${curSym}${realizedPnL.toLocaleString()}`);
  };

  // Helper to calculate live stats for a portfolio card
  const getPortfolioStats = (p: SavedPortfolio) => {
    const activeSpot = (underlying && p.symbol.toUpperCase() === symbol.toUpperCase()) 
      ? underlying.spot 
      : (p.legs[0]?.strike || 100);

    let totalUnrealizedPnL = 0;
    for (const leg of p.legs) {
      const pnlData = projectLegPnL(leg, activeSpot, 0, 0);
      totalUnrealizedPnL += pnlData.pnl;
    }

    const { metrics } = projectStrategy(p.legs, activeSpot, 0, 0, 0.05, p.symbol);
    const unrealizedPnL = Math.round(totalUnrealizedPnL * 100) / 100;

    // Peak Profit and Max Drawdown tracking
    let peakProfit = p.peakProfit ?? 0.0;
    let maxDrawdown = p.maxDrawdown ?? 0.0;
    let needsUpdate = false;

    if (unrealizedPnL > peakProfit) {
      peakProfit = unrealizedPnL;
      needsUpdate = true;
    }
    if (unrealizedPnL < maxDrawdown) {
      maxDrawdown = unrealizedPnL;
      needsUpdate = true;
    }

    if (needsUpdate && user?.role !== 'viewer') {
      p.peakProfit = peakProfit;
      p.maxDrawdown = maxDrawdown;
      updatePortfolio(p).catch(err => console.error("Failed to update peak/drawdown MTM", err));
    }

    return {
      spotPrice: activeSpot,
      unrealizedPnL,
      margin: metrics.marginRequirement,
      delta: metrics.delta,
      theta: metrics.theta,
      peakProfit,
      maxDrawdown,
      metrics
    };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-borderClr/30 pb-3 px-1">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Paper Trading Book</h3>
          <p className="text-[10px] text-gray-500">Monitor live executed paper trades and historical realized logs.</p>
        </div>

        {/* View toggle */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setViewMode('open')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              viewMode === 'open'
                ? "bg-accentBrand border-accentBrand text-white"
                : "bg-gray-950 border-borderClr/60 text-gray-400 hover:text-white"
            }`}
          >
            Open Positions ({openPositions.length})
          </button>
          <button
            onClick={() => setViewMode('closed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              viewMode === 'closed'
                ? "bg-accentBrand border-accentBrand text-white"
                : "bg-gray-950 border-borderClr/60 text-gray-400 hover:text-white"
            }`}
          >
            Closed Trades History ({closedHistory.length})
          </button>
          <button
            onClick={() => setViewMode('alerts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              viewMode === 'alerts'
                ? "bg-accentBrand border-accentBrand text-white"
                : "bg-gray-950 border-borderClr/60 text-gray-400 hover:text-white"
            }`}
          >
            Auto-Scanner Alerts ({triggeredAlerts.length})
          </button>
          {viewMode === 'alerts' && triggeredAlerts.length > 0 && (
            <button
              onClick={handleClearAllAlerts}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-500/20 bg-red-950/40 text-red-400 hover:text-red-300 hover:border-red-500/50 cursor-pointer ml-1 animate-fadeIn"
            >
              Delete All
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-xl p-4">
        {/* Render Open Positions */}
        {viewMode === 'open' && (
          sortedOpenPositions.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-500 flex flex-col items-center gap-2">
              <Briefcase className="w-8 h-8 text-gray-600 animate-pulse" />
              <span>No open paper positions. Execute a strategy from the Scanner or Strategy Builder to trade.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-borderClr/30 bg-gray-950/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-borderClr bg-gray-900 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    {renderSortHeader("Symbol / Strategy", "symbol", openSortKey, openSortOrder, setOpenSortKey, setOpenSortOrder)}
                    {renderSortHeader("Date Executed", "date", openSortKey, openSortOrder, setOpenSortKey, setOpenSortOrder)}
                    <th className="py-3 px-3">Contract Legs</th>
                    <th className="py-3 px-3">Spot (Entry / Cur)</th>
                    <th className="py-3 px-3">Peak / Max DD</th>
                    {renderSortHeader("Max Profit", "maxProfit", openSortKey, openSortOrder, setOpenSortKey, setOpenSortOrder)}
                    {renderSortHeader("Max Loss", "maxLoss", openSortKey, openSortOrder, setOpenSortKey, setOpenSortOrder)}
                    <th className="py-3 px-3 min-w-[140px]">Rules (TP / SL)</th>
                    {renderSortHeader("Live P&L", "pnl", openSortKey, openSortOrder, setOpenSortKey, setOpenSortOrder)}
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOpenPositions.map((p: SavedPortfolio) => {
                    const stats = getPortfolioStats(p);
                    const isCurrentSymbol = p.symbol.toUpperCase() === symbol.toUpperCase();
                    const metrics = stats.metrics;
                    const cur = getCurrencySymbol(p.symbol);
                    const compactLegs = formatLegsCompact(p.legs, p.symbol);
                    const tpVal = tempTakeProfit[p.id] ?? p.takeProfit ?? 20;
                    const slVal = tempStopLoss[p.id] ?? p.stopLoss ?? 0;
                    const maxProfitNum = typeof metrics.maxProfit === 'number' ? metrics.maxProfit : 0;
                    const maxLossNum = typeof metrics.maxLoss === 'number' ? metrics.maxLoss : 0;
                    const tpTrigger = Math.round(maxProfitNum * (tpVal / 100));
                    const slTrigger = Math.round(-maxLossNum * (slVal / 100));

                    const isTpTriggered = tpVal > 0 && stats.unrealizedPnL >= tpTrigger && metrics.maxProfit !== 'Unlimited';
                    const isSlTriggered = slVal > 0 && stats.unrealizedPnL <= slTrigger && metrics.maxLoss !== 'Unlimited';

                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => handleLoad(p)}
                        className={`border-b border-borderClr/10 hover:bg-gray-800/10 transition-all cursor-pointer ${
                          isCurrentSymbol ? "bg-accentCyan/5" : ""
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-white">
                              {p.symbol}
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold">{p.name}</span>
                            {p.legs[0]?.expiry && (
                              <span className="text-[9px] text-accentCyan font-bold">Exp: {p.legs[0].expiry}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-400 font-medium">
                          {p.createdAt || "Recently"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-gray-900 border border-borderClr/30 text-[10px] font-bold text-gray-300">
                            {compactLegs}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold">
                          <div className="flex flex-col">
                            <span className="text-white text-[10px]">Entry: {cur}{p.entrySpot?.toLocaleString(undefined, {minimumFractionDigits: 2}) || "N/A"}</span>
                            <span className="text-gray-400 text-[10px]">LTP: {cur}{stats.spotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col text-[10px] font-semibold text-gray-400">
                            <span className="text-greenBrand font-bold">↑ Peak: {cur}{stats.peakProfit.toLocaleString()}</span>
                            <span className="text-redBrand font-bold">↓ DD: {cur}{stats.maxDrawdown.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-greenBrand">
                          {typeof metrics.maxProfit === 'number' ? `${cur}${metrics.maxProfit.toLocaleString()}` : metrics.maxProfit}
                        </td>
                        <td className="py-3 px-3 font-bold text-redBrand">
                          {typeof metrics.maxLoss === 'number' ? `${cur}${metrics.maxLoss.toLocaleString()}` : metrics.maxLoss}
                        </td>
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1.5 text-[9px] max-w-[150px]">
                            {/* TP Slider */}
                            <div className="flex flex-col gap-0.5">
                              <div className="flex justify-between font-bold">
                                <span className="text-gray-400 font-bold">TP: <strong className="text-greenBrand">{tpVal}%</strong></span>
                                <span className="text-gray-500 font-semibold">{metrics.maxProfit === 'Unlimited' ? 'Unlimited' : `${cur}${tpTrigger.toLocaleString()}`}</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={tpVal}
                                disabled={user?.role === 'viewer'}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setTempTakeProfit(prev => ({ ...prev, [p.id]: val }));
                                }}
                                onMouseUp={() => handleTakeProfitChange(p, tpVal)}
                                onTouchEnd={() => handleTakeProfitChange(p, tpVal)}
                                className={`w-full h-1 bg-gray-800 rounded-lg appearance-none accent-greenBrand ${
                                  user?.role === 'viewer' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                }`}
                              />
                            </div>
                            {/* SL Slider */}
                            <div className="flex flex-col gap-0.5">
                              <div className="flex justify-between font-bold">
                                <span className="text-gray-400 font-bold">SL: <strong className="text-redBrand">{slVal}%</strong></span>
                                <span className="text-gray-500 font-semibold">{metrics.maxLoss === 'Unlimited' ? 'Unlimited' : `${cur}${slTrigger.toLocaleString()}`}</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={slVal}
                                disabled={user?.role === 'viewer'}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setTempStopLoss(prev => ({ ...prev, [p.id]: val }));
                                }}
                                onMouseUp={() => handleStopLossChange(p, slVal)}
                                onTouchEnd={() => handleStopLossChange(p, slVal)}
                                className={`w-full h-1 bg-gray-800 rounded-lg appearance-none accent-redBrand ${
                                  user?.role === 'viewer' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                }`}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 items-end">
                            <span className={`px-2 py-0.5 rounded font-extrabold text-xs border ${
                              stats.unrealizedPnL >= 0 
                                ? "bg-greenBrand/10 border-greenBrand/25 text-greenBrand" 
                                : "bg-redBrand/10 border-redBrand/25 text-redBrand"
                            }`}>
                              {stats.unrealizedPnL >= 0 ? "+" : ""}{cur}{stats.unrealizedPnL.toLocaleString()}
                            </span>
                            <div className="flex gap-1">
                              {isTpTriggered && (
                                <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-greenBrand/20 text-greenBrand border border-greenBrand/35 animate-pulse">
                                  TP
                                </span>
                              )}
                              {isSlTriggered && (
                                <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-redBrand/20 text-redBrand border border-redBrand/35 animate-pulse">
                                  SL
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setPayoffModalData({
                                  legs: p.legs,
                                  spot: stats.spotPrice,
                                  expiry: p.legs[0]?.expiry || "",
                                  symbol: p.symbol,
                                  name: p.name
                                });
                                setPayoffModalOpen(true);
                              }}
                              className="p-1 text-gray-500 hover:text-accentCyan hover:bg-gray-800 rounded transition-all"
                              title="View Payoff Curve"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleLoad(p)}
                              className="p-1 text-gray-500 hover:text-accentBrand hover:bg-gray-800 rounded transition-all"
                              title="Load Strategy to Sandbox"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            {user?.role !== 'viewer' && (
                              <button
                                onClick={(e) => handleSquareOff(p, e)}
                                className="p-1 text-gray-500 hover:text-redBrand hover:bg-gray-800 rounded transition-all"
                                title="Square Off Position"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Render Closed History */}
        {viewMode === 'closed' && (
          closedHistory.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-500 flex flex-col items-center gap-2">
              <Clock className="w-8 h-8 text-gray-600" />
              <span>No closed trades in history. Square off an open position to log results.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-borderClr/30 bg-gray-950/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-borderClr bg-gray-900 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    {renderSortHeader("Symbol", "symbol", closedSortKey, closedSortOrder, setClosedSortKey, setClosedSortOrder)}
                    {renderSortHeader("Strategy Name", "name", closedSortKey, closedSortOrder, setClosedSortKey, setClosedSortOrder)}
                    {renderSortHeader("Date Executed", "date", closedSortKey, closedSortOrder, setClosedSortKey, setClosedSortOrder)}
                    <th className="py-3 px-3">Contract Legs</th>
                    {renderSortHeader("Realized Profit / Loss", "pnl", closedSortKey, closedSortOrder, setClosedSortKey, setClosedSortOrder)}
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClosedHistory.map((p: SavedPortfolio) => {
                    const cur = getCurrencySymbol(p.symbol);
                    return (
                      <tr key={p.id} className="border-b border-borderClr/10 hover:bg-gray-800/10 transition-all">
                        <td className="py-3.5 px-4 font-extrabold text-white">
                          <span className="px-2 py-0.5 rounded bg-gray-900 border border-borderClr/40">
                            {p.symbol}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-white">{p.name}</td>
                        <td className="py-3.5 px-3 text-gray-400">{p.createdAt || "Recently"}</td>
                        <td className="py-3.5 px-3 text-gray-400">{p.legs.length} Option/Future leg(s)</td>
                        <td className={`py-3.5 px-3 font-extrabold text-sm ${(p.realizedPnL ?? 0) >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                          {(p.realizedPnL ?? 0) >= 0 ? "+" : ""}{cur}{(p.realizedPnL ?? 0).toLocaleString()}
                        </td>
                      <td className="py-3.5 px-4 text-center">
                        {user?.role !== 'viewer' && (
                          <button
                            onClick={(e) => handleDelete(p.id, e)}
                            className="p-1.5 bg-redBrand/10 hover:bg-redBrand/20 text-redBrand rounded-lg transition-all"
                            title="Delete Closed Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Render Auto-Scanner Alerts */}
        {viewMode === 'alerts' && (
          triggeredAlerts.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-500 flex flex-col items-center gap-2">
              <Clock className="w-8 h-8 text-gray-600 animate-pulse" />
              <span>No triggered alerts from the auto-scanner. Alerts will appear here when rules are matched.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-borderClr/30 bg-gray-950/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-borderClr bg-gray-900 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    {renderSortHeader("Symbol / Expiry", "symbol", alertSortKey, alertSortOrder, setAlertSortKey, setAlertSortOrder)}
                    {renderSortHeader("Strategy Name", "name", alertSortKey, alertSortOrder, setAlertSortKey, setAlertSortOrder)}
                    {renderSortHeader("Triggered Time", "time", alertSortKey, alertSortOrder, setAlertSortKey, setAlertSortOrder)}
                    <th className="py-3 px-3">Spot Price</th>
                    <th className="py-3 px-3">Contract Legs</th>
                    <th className="py-3 px-3">Stats</th>
                    {renderSortHeader("Max Loss", "maxLoss", alertSortKey, alertSortOrder, setAlertSortKey, setAlertSortOrder)}
                    {renderSortHeader("Live P&L", "pnl", alertSortKey, alertSortOrder, setAlertSortKey, setAlertSortOrder)}
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTriggeredAlerts.slice(0, 30).map((trig: TriggeredAlert) => {
                    const compactLegs = formatLegsCompact(trig.legs, trig.symbol);
                    const pnl = getAlertCurrentPnL(trig);
                    const activeSpot = alertSpotPrices[trig.symbol.toUpperCase()] || trig.spotPrice || (trig.legs[0]?.strike || 100);
                    const cur = getCurrencySymbol(trig.symbol);

                    return (
                      <tr key={trig.id} className="border-b border-borderClr/10 hover:bg-gray-800/10 transition-all">
                        <td className="py-3.5 px-4 font-extrabold text-white">
                          <span className="px-2 py-0.5 rounded bg-gray-900 border border-borderClr/40 mr-1.5">
                            {trig.symbol}
                          </span>
                          <span className="text-[10px] text-accentCyan font-bold uppercase">{trig.expiry}</span>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-white">
                          {trig.strategyName.split(" (")[0]}
                        </td>
                        <td className="py-3.5 px-3 text-gray-400">
                          {trig.timestamp}
                        </td>
                        <td className="py-3.5 px-3 text-gray-300 text-[11px]">
                          <div>Entry: <span className="font-bold">{cur}{trig.spotPrice?.toLocaleString(undefined, {minimumFractionDigits: 1}) || "N/A"}</span></div>
                          <div className="text-gray-400 mt-0.5">LTP: <span className="font-bold text-white">{cur}{activeSpot.toLocaleString(undefined, {minimumFractionDigits: 1})}</span></div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="py-1 px-2 rounded bg-gray-950/60 border border-borderClr/20 text-[10px] font-bold text-gray-400 font-mono">
                            {compactLegs}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-gray-300 text-[11px]">
                          <div>POP: <span className="text-greenBrand font-bold">{trig.pop}%</span></div>
                          <div className="text-gray-400 mt-0.5">R:R: 1:{trig.rrRatio.toFixed(1)}</div>
                        </td>
                        <td className="py-3.5 px-3 text-redBrand font-semibold">
                          {cur}{typeof trig.maxLoss === 'number' ? trig.maxLoss.toLocaleString() : String(trig.maxLoss)}
                        </td>
                        <td className="py-3.5 px-3 font-extrabold">
                          <span className={`px-2.5 py-1 rounded border text-xs ${
                            pnl >= 0 
                              ? "bg-greenBrand/10 border-greenBrand/25 text-greenBrand" 
                              : "bg-redBrand/10 border-redBrand/25 text-redBrand"
                          }`}>
                            {pnl >= 0 ? "+" : ""}{cur}{pnl.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                const normalizedLegs = normalizeLegQuantities(trig.legs, trig.symbol);
                                setPayoffModalData({
                                  legs: normalizedLegs,
                                  spot: activeSpot,
                                  expiry: trig.expiry,
                                  symbol: trig.symbol,
                                  name: trig.strategyName
                                });
                                setPayoffModalOpen(true);
                              }}
                              className="p-1.5 bg-accentCyan/10 hover:bg-accentCyan/20 text-accentCyan rounded-lg transition-all"
                              title="View Payoff Curve"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                            </button>
                            {user?.role !== 'viewer' && (
                              <button
                                onClick={() => {
                                  const normalizedLegs = normalizeLegQuantities(trig.legs, trig.symbol);
                                  setExecuteModalData({
                                    legs: normalizedLegs,
                                    symbol: trig.symbol,
                                    strategyName: trig.strategyName,
                                    description: `Executed from auto-scanner alert at spot ${cur}${trig.spotPrice}`
                                  });
                                  setSelectedBroker('paper');
                                  setExecuteModalOpen(true);
                                }}
                                className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-all"
                                title="Execute Trade"
                              >
                                <Coins className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleLoadAlert(trig)}
                              className="p-1.5 bg-accentBrand/10 hover:bg-accentBrand/20 text-accentBrand rounded-lg transition-all"
                              title="Load Strategy to Builder"
                            >
                              <Play className="w-3.5 h-3.5 fill-accentBrand" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteAlert(trig.id, e)}
                              className="p-1.5 bg-redBrand/10 hover:bg-redBrand/20 text-redBrand rounded-lg border border-redBrand/10 transition-all"
                              title="Delete Alert Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Payoff Modal */}
      {payoffModalOpen && payoffModalData && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-panel max-w-4xl w-full rounded-2xl border border-borderClr/40 p-6 flex flex-col gap-5 shadow-2xl bg-gray-950/95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-borderClr/25 pb-3">
              <div className="flex flex-col gap-1.5 text-left">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-accentCyan" />
                  Strategy Payoff Diagram
                </h4>
                <div className="flex flex-col gap-1">
                  <span className="text-sm md:text-base font-extrabold text-accentCyan">{payoffModalData.name} ({payoffModalData.symbol})</span>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {payoffModalData.legs && payoffModalData.legs.map((leg: any, idx: number) => {
                      const cur = getCurrencySymbol(payoffModalData.symbol);
                      const actionColor = leg.action === 'BUY' ? 'text-green-400 bg-green-950/40 border-green-500/30' : 'text-red-400 bg-red-950/40 border-red-500/30';
                      return (
                        <span key={idx} className={`px-2.5 py-0.5 rounded text-[10px] md:text-xs font-bold border ${actionColor}`}>
                          {leg.action} {leg.quantity}x {leg.optionType === 'C' ? 'CE' : leg.optionType === 'P' ? 'PE' : 'FUT'} {cur}{leg.strike}
                          {leg.entryPrice !== undefined && leg.entryPrice !== null && leg.entryPrice !== 0 && ` @ ${cur}${leg.entryPrice}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setPayoffModalOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            {/* Payoff Chart Component */}
            <PayoffChart 
              customLegs={payoffModalData.legs}
              customSpot={payoffModalData.spot}
              customExpiry={payoffModalData.expiry}
              customSymbol={payoffModalData.symbol}
            />
          </div>
        </div>
      )}

      {/* Trade Execution Modal */}
      {executeModalOpen && executeModalData && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-borderClr/40 p-6 flex flex-col gap-5 shadow-2xl bg-gray-950/95">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-borderClr/25 pb-3">
              <div className="flex flex-col gap-0.5">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-greenBrand" />
                  Execute Strategy Orders
                </h4>
                <span className="text-[10px] text-gray-500 font-semibold">{executeModalData.strategyName}</span>
              </div>
              <button 
                onClick={() => setExecuteModalOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Broker Selection Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Select Execution Broker</span>
              <div className="grid grid-cols-3 gap-2">
                {/* Paper Trading */}
                <button
                  onClick={() => setSelectedBroker('paper')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedBroker === 'paper'
                      ? "bg-accentCyan/15 border-accentCyan text-white"
                      : "bg-gray-950/60 border-borderClr/40 text-gray-500 hover:text-white hover:border-gray-700"
                  }`}
                >
                  <span className="text-xs font-bold">Paper Trade</span>
                  <span className="text-[8px] text-gray-500 leading-tight">Simulated execution with local tracking</span>
                </button>

                {/* Dhan API */}
                <button
                  onClick={() => setSelectedBroker('dhan')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedBroker === 'dhan'
                      ? "bg-greenBrand/15 border-greenBrand text-white"
                      : "bg-gray-950/60 border-borderClr/40 text-gray-500 hover:text-white hover:border-gray-700"
                  }`}
                >
                  <span className="text-xs font-bold">Dhan API</span>
                  <span className="text-[8px] text-gray-500 leading-tight">Live derivative trading via DhanHQ F&O</span>
                </button>

                {/* Kotak Neo */}
                <button
                  onClick={() => setSelectedBroker('kotak')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedBroker === 'kotak'
                      ? "bg-yellow-500/15 border-yellow-500 text-white"
                      : "bg-gray-950/60 border-borderClr/40 text-gray-500 hover:text-white hover:border-gray-700"
                  }`}
                >
                  <span className="text-xs font-bold">Kotak Neo</span>
                  <span className="text-[8px] text-gray-500 leading-tight">Live execution via Kotak Neo API</span>
                </button>
              </div>
            </div>

            {/* Leg Breakdown */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Strategy Legs Breakdown</span>
              <div className="bg-gray-950/50 border border-borderClr/25 rounded-xl p-3 flex flex-col gap-2 max-h-[140px] overflow-y-auto scrollbar-thin">
                {executeModalData.legs.map((leg: any, idx: number) => {
                  const isBuy = leg.action === 'BUY';
                  const typeLabel = leg.optionType === 'C' ? 'CE' : leg.optionType === 'P' ? 'PE' : 'FUT';
                  const cur = getCurrencySymbol(executeModalData.symbol);
                  return (
                    <div 
                      key={idx}
                      className="flex justify-between items-center text-xs border-b border-borderClr/10 pb-1.5 last:border-b-0 last:pb-0"
                    >
                      <span className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {leg.action}
                        </span>
                        <span className="font-bold text-white">{leg.quantity}x {leg.strike} {typeLabel}</span>
                      </span>
                      <span className="text-gray-400">Entry: {cur}{leg.entryPrice.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Execution Footer */}
            <div className="flex gap-3 border-t border-borderClr/25 pt-4 mt-1">
              <button
                onClick={() => setExecuteModalOpen(false)}
                className="flex-1 py-2 text-xs font-bold text-gray-400 bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors border border-borderClr/30"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteTrade}
                disabled={isExecutingTrade || (selectedBroker !== 'paper' && user?.role === 'viewer')}
                className={`flex-1 py-2 text-xs font-extrabold text-white rounded-xl transition-all shadow-md ${
                  isExecutingTrade 
                    ? "bg-gray-800 cursor-not-allowed text-gray-500" 
                    : (selectedBroker !== 'paper' && user?.role === 'viewer')
                      ? "bg-redBrand/20 text-redBrand/60 cursor-not-allowed"
                      : "bg-accentBrand hover:bg-accentBrand/90 hover:shadow-accentBrand/20"
                }`}
              >
                {isExecutingTrade ? "Executing..." : "Confirm Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
