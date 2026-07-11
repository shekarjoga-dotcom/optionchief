import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { 
  Bell, Plus, Trash2, PlusCircle, Play, Clock, Activity, X,
  ChevronLeft, ChevronRight, TrendingUp, XCircle, Pencil
} from 'lucide-react';
import { PayoffChart } from './PayoffChart';
import type { AlertRule, TriggeredAlert } from '../types';
import { projectStrategy, projectLegPnL, normalizeLegQuantities, getCurrencySymbol } from '../utils/optionsMath';
import {
  ResponsiveContainer,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Area,
  CartesianGrid
} from 'recharts';

import { BACKEND_URL } from '../config';

export const AlertsPanel: React.FC = () => {
  const { 
    symbol, 
    underlying, 
    token, 
    user, 
    isAutoScanning, 
    autoScanInterval, 
    setAutoScanning, 
    alertRules,
    fetchAlertRules,
    saveAlertRule,
    deleteAlertRule,
    deleteAllAlertRules,
    toggleAlertRule,
    fetchPortfolios,
    executionConfig
  } = useStore();
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);
  
  // Alert Rule States
  const [alertStrategyType, setAlertStrategyType] = useState("1:3:2");
  const [alertSymbol, setAlertSymbol] = useState<string>("ALL");
  const [alertExpiry, setAlertExpiry] = useState<string>("ALL");
  const [alertMinPop, setAlertMinPop] = useState<number>(25);
  const [alertMinRR, setAlertMinRR] = useState<number>(6);
  const [alertMinLoss, setAlertMinLoss] = useState<number>(0);
  const [alertMaxLoss, setAlertMaxLoss] = useState<number>(3000);
  const [alertMinDelta, setAlertMinDelta] = useState<string>("");
  const [alertMaxDelta, setAlertMaxDelta] = useState<string>("");
  const [alertMinTheta, setAlertMinTheta] = useState<string>("");
  const [alertMaxGamma, setAlertMaxGamma] = useState<string>("");
  const [alertAutoExecute, setAlertAutoExecute] = useState<boolean>(false);
  const [alertTakeProfit, setAlertTakeProfit] = useState<number>(20);
  const [alertStopLoss, setAlertStopLoss] = useState<number>(0);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const [formExpiries, setFormExpiries] = useState<string[]>([]);

  const symbolOptions = useMemo(() => {
    const base = [
      "ALL", "ALL_NSE", "NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", 
      "RELIANCE", "SBIN", "ITC", 
      "CRUDEOIL", "CRUDEM", "NATURALGAS", "NATGASMINI", 
      "GOLD", "GOLDM", "SILVER", "SILVERM", 
      "SPY", "AAPL", "TSLA"
    ];
    if (symbol && !base.includes(symbol)) {
      base.push(symbol);
    }
    return base;
  }, [symbol]);

  useEffect(() => {
    fetchAlertRules();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchExpiriesForSymbol = async () => {
      try {
        const targetSym = (alertSymbol === "ALL" || alertSymbol === "ALL_NSE") ? "NIFTY" : alertSymbol;
        const response = await fetch(`${BACKEND_URL}/api/market/option-chain?symbol=${targetSym}`);
        if (response.ok && isMounted) {
          const data = await response.json();
          if (data.expiry_dates) {
            setFormExpiries(data.expiry_dates);
            if (alertExpiry !== "ALL" && !data.expiry_dates.includes(alertExpiry)) {
              setAlertExpiry("ALL");
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch expiries for symbol", alertSymbol, err);
      }
    };

    fetchExpiriesForSymbol();
    return () => {
      isMounted = false;
    };
  }, [alertSymbol, alertExpiry]);
  
  // Rules List & Trigger Logs

  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<TriggeredAlert | null>(null);

  const [alertSpotPrices, setAlertSpotPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchSpotPrices = async () => {
      const uniqueSymbols = Array.from(new Set(triggeredAlerts.map(t => t.symbol.toUpperCase())));
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
  }, [triggeredAlerts, symbol, underlying]);

  const getAlertCurrentPnL = (trig: TriggeredAlert) => {
    const activeSpot = alertSpotPrices[trig.symbol.toUpperCase()] || trig.spotPrice || (trig.legs[0]?.strike || 100);

    let totalPnL = 0;
    for (const leg of trig.legs) {
      const pnlData = projectLegPnL(leg, activeSpot, 0, 0);
      totalPnL += pnlData.pnl;
    }
    return Math.round(totalPnL * 100) / 100;
  };

  // Settings states
  const [notificationChannel, setNotificationChannel] = useState<string>(() => localStorage.getItem("options_oracle_notification_channel") || "web_only");
  const [alertPhoneOverride, setAlertPhoneOverride] = useState<string>(() => localStorage.getItem("options_oracle_alert_phone_override") || "");
  const [telegramBotToken, setTelegramBotToken] = useState<string>(() => localStorage.getItem("options_oracle_telegram_bot_token") || "");
  const [telegramChatId, setTelegramChatId] = useState<string>(() => localStorage.getItem("options_oracle_telegram_chat_id") || "");
  const [alertWhatsappOverride, setAlertWhatsappOverride] = useState<string>(() => localStorage.getItem("options_oracle_alert_whatsapp_override") || "");
  const [alertRecipientEmail, setAlertRecipientEmail] = useState<string>(() => localStorage.getItem("options_oracle_alert_recipient_email") || "");

  // Payoff chart simulation state for the selected alert
  const [alertDaysPassed, setAlertDaysPassed] = useState(0);
  const [alertIvOffset, setAlertIvOffset] = useState(0);

  // Payoff Modal state
  const [payoffModalOpen, setPayoffModalOpen] = useState(false);
  const [payoffModalData, setPayoffModalData] = useState<{
    legs: any[];
    spot: number;
    expiry: string;
    symbol: string;
    name: string;
  } | null>(null);

  // Order execution state
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<'paper' | 'delta_demo' | 'delta_live'>('paper');
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);

  // Countdown timer local state
  const [nextScanSec, setNextScanSec] = useState(autoScanInterval);

  // Sync state loops

  useEffect(() => {
    localStorage.setItem("options_oracle_notification_channel", notificationChannel);
  }, [notificationChannel]);

  useEffect(() => {
    localStorage.setItem("options_oracle_alert_phone_override", alertPhoneOverride);
  }, [alertPhoneOverride]);

  useEffect(() => {
    localStorage.setItem("options_oracle_telegram_bot_token", telegramBotToken);
  }, [telegramBotToken]);

  useEffect(() => {
    localStorage.setItem("options_oracle_telegram_chat_id", telegramChatId);
  }, [telegramChatId]);

  useEffect(() => {
    localStorage.setItem("options_oracle_alert_whatsapp_override", alertWhatsappOverride);
  }, [alertWhatsappOverride]);

  useEffect(() => {
    localStorage.setItem("options_oracle_alert_recipient_email", alertRecipientEmail);
  }, [alertRecipientEmail]);

  // Load triggered alerts from localStorage periodically
  const loadTriggers = () => {
    try {
      const saved = localStorage.getItem("options_oracle_triggered_alerts");
      const list = saved ? JSON.parse(saved) : [];
      setTriggeredAlerts(list);
      // Auto-select first alert if none selected
      if (list.length > 0 && !selectedAlert) {
        setSelectedAlert(list[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadTriggers();
    // Poll local triggers for updates in background
    const timer = setInterval(loadTriggers, 5000);
    return () => clearInterval(timer);
  }, [selectedAlert]);

  // Countdown ticker effect
  useEffect(() => {
    if (!isAutoScanning) {
      setNextScanSec(autoScanInterval);
      return;
    }
    const timer = setInterval(() => {
      setNextScanSec(prev => {
        if (prev <= 1) {
          // Scan triggers, resets to interval
          return autoScanInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isAutoScanning, autoScanInterval]);

  // Sync countdown when autoScanInterval changes
  useEffect(() => {
    setNextScanSec(autoScanInterval);
  }, [autoScanInterval]);

  const handleAddAlertRule = () => {
    const newRule: AlertRule = {
      id: editingRuleId || Math.random().toString(36).substring(2, 9),
      strategyType: alertStrategyType,
      minPop: alertMinPop,
      minRR: alertMinRR,
      minLoss: alertMinLoss,
      maxLoss: alertMaxLoss,
      active: true,
      expiry: alertExpiry,
      symbol: alertSymbol,
      minDelta: alertMinDelta !== "" ? parseFloat(alertMinDelta) : undefined,
      maxDelta: alertMaxDelta !== "" ? parseFloat(alertMaxDelta) : undefined,
      minTheta: alertMinTheta !== "" ? parseFloat(alertMinTheta) : undefined,
      maxGamma: alertMaxGamma !== "" ? parseFloat(alertMaxGamma) : undefined,
      autoExecute: alertAutoExecute,
      takeProfit: alertTakeProfit,
      stopLoss: alertStopLoss
    };
    saveAlertRule(newRule);
    
    const wasEditing = !!editingRuleId;
    setEditingRuleId(null);
    setAlertMinLoss(0);
    setAlertMinDelta("");
    setAlertMaxDelta("");
    setAlertMinTheta("");
    setAlertMaxGamma("");
    setAlertAutoExecute(false);
    setAlertTakeProfit(20);
    setAlertStopLoss(0);
    
    alert(wasEditing
      ? `Alert rule successfully updated for ${getStrategyLabel(alertStrategyType)} strategy!`
      : `Alert rule successfully created for ${getStrategyLabel(alertStrategyType)} strategy!`
    );
  };

  const handleEditAlertRule = (rule: AlertRule) => {
    setAlertStrategyType(rule.strategyType);
    setAlertSymbol(rule.symbol);
    setAlertExpiry(rule.expiry);
    setAlertMinPop(rule.minPop);
    setAlertMinRR(rule.minRR);
    setAlertMinLoss(rule.minLoss || 0);
    setAlertMaxLoss(rule.maxLoss);
    setAlertMinDelta(rule.minDelta !== undefined ? String(rule.minDelta) : "");
    setAlertMaxDelta(rule.maxDelta !== undefined ? String(rule.maxDelta) : "");
    setAlertMinTheta(rule.minTheta !== undefined ? String(rule.minTheta) : "");
    setAlertMaxGamma(rule.maxGamma !== undefined ? String(rule.maxGamma) : "");
    setAlertAutoExecute(!!rule.autoExecute);
    setAlertTakeProfit(rule.takeProfit ?? 20);
    setAlertStopLoss(rule.stopLoss ?? 0);
    setEditingRuleId(rule.id);

    const formEl = document.getElementById("create-rule-form-section");
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRemoveAlertRule = (id: string) => {
    deleteAlertRule(id);
  };

  const handleDeleteAllAlertRules = () => {
    if (window.confirm("Are you sure you want to delete all alert rules? This cannot be undone.")) {
      deleteAllAlertRules();
    }
  };

  const handleSelectRuleTriggers = (ruleId: string) => {
    const matched = triggeredAlerts.find(t => t.ruleId === ruleId);
    if (matched) {
      setSelectedAlert(matched);
      setAlertDaysPassed(0);
      setAlertIvOffset(0);
      setIsLogCollapsed(false);
    } else {
      alert("No alert has been triggered under this rule yet. It will automatically load the payoff graph here once matched by the scanner.");
    }
  };

  const getStrategyLabel = (type: string) => {
    if (type === "ALL") return "All Strategies";
    if (type === "1:3:2") return "1:3:2 Ratio Butterfly";
    if (type === "PROTECTIVE PUT") return "Protective Put (Married Put)";
    if (type === "ZERO COST COLLAR") return "Zero-Cost Collar";
    if (type === "PUT SPREAD COLLAR") return "Put Spread Collar";
    return type;
  };

  const handleToggleAutoScan = () => {
    const nextState = !isAutoScanning;
    setAutoScanning(nextState, autoScanInterval);
  };

  const handleIntervalChange = (val: number) => {
    setAutoScanning(isAutoScanning, val);
  };

  const handleClearTriggers = () => {
    if (confirm("Are you sure you want to clear all triggered alerts?")) {
      localStorage.setItem("options_oracle_triggered_alerts", "[]");
      setTriggeredAlerts([]);
      setSelectedAlert(null);
    }
  };

  // Determine correct underlying spot price for payoff simulation
  const alertSpotPrice = useMemo(() => {
    if (!selectedAlert || selectedAlert.legs.length === 0) return 100;
    // 1. If we have live spot price, use it
    const liveSpot = alertSpotPrices[selectedAlert.symbol.toUpperCase()];
    if (liveSpot) return liveSpot;
    // 2. If alert object has spotPrice, use it
    if (selectedAlert.spotPrice) return selectedAlert.spotPrice;
    // 3. If the alert is for the currently selected symbol in store, use current store spot
    if (selectedAlert.symbol === symbol && underlying?.spot) {
      return underlying.spot;
    }
    // 4. Fallback: average strike of the legs (which is ATM center of strategy)
    const strikes = selectedAlert.legs.map(l => l.strike);
    return strikes.reduce((a, b) => a + b, 0) / strikes.length;
  }, [selectedAlert, symbol, underlying, alertSpotPrices]);

  // Payoff calculations for selected alert
  const payoffData = useMemo(() => {
    if (!selectedAlert || selectedAlert.legs.length === 0) return { payoff: [], metrics: null };
    return projectStrategy(selectedAlert.legs, alertSpotPrice, alertDaysPassed, alertIvOffset, 0.05, selectedAlert.symbol);
  }, [selectedAlert, alertSpotPrice, alertDaysPassed, alertIvOffset]);

  const totalDays = useMemo(() => {
    if (!selectedAlert || !selectedAlert.expiry) return 10;
    const today = new Date();
    const expiryDate = new Date(selectedAlert.expiry);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [selectedAlert]);

  // Execute trade backend F&O caller
  const handlePlaceOrder = async () => {
    if (!selectedAlert) return;
    setIsExecutingTrade(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/portfolio/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          broker: selectedBroker,
          name: selectedAlert.strategyName.split(" (")[0],
          symbol: selectedAlert.symbol,
          description: `Executed via real-time alerts under ${selectedBroker.toUpperCase()}`,
          legs: normalizeLegQuantities(selectedAlert.legs, selectedAlert.symbol)
        })
      });

      const data = await response.json();
      if (response.ok && data.status === "success") {
        let msg = `Successfully executed strategy on ${selectedBroker.toUpperCase()}!\n`;
        if (data.orders && data.orders.length > 0) {
          data.orders.forEach((o: any) => {
            msg += `\nLeg ${o.strike || 'Future'} (${o.action}): ${o.status} - ${o.message}`;
          });
        }
        alert(msg);
        setTradeModalOpen(false);
        fetchPortfolios(); // Refresh positions
      } else {
        alert(`Order placement failed: ${data.detail || "Unknown error"}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Connection failed: ${err.message}`);
    } finally {
      setIsExecutingTrade(false);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const priceVal = payload[0].payload?.price;
      const pnlCurrVal = payload[0].value;
      const pnlExpVal = payload[1]?.value ?? 0;
      return (
        <div className="bg-gray-950/90 border border-borderClr p-2.5 rounded-lg text-xs flex flex-col gap-1 shadow-lg">
          <span className="text-white font-extrabold">Price: {priceVal != null ? priceVal.toLocaleString() : ""}</span>
          <span className="text-accentCyan">T+0: {pnlCurrVal != null ? (pnlCurrVal >= 0 ? "+" : "") + pnlCurrVal.toLocaleString() : "0"}</span>
          <span className="text-purple-400">Exp: {pnlExpVal != null ? (pnlExpVal >= 0 ? "+" : "") + pnlExpVal.toLocaleString() : "0"}</span>
        </div>
      );
    }
    return null;
  };

  const selectedPnL = selectedAlert ? getAlertCurrentPnL(selectedAlert) : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* LEFT COLUMN: Configuration and Rules */}
      <div className="xl:col-span-1 flex flex-col gap-6">
        {/* Auto-scanning Dashboard controller */}
        <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-4 bg-gray-950/40">
          <div className="flex items-center justify-between border-b border-borderClr/20 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Auto-Scanner Engine</h3>
              <p className="text-[10px] text-gray-500">Run strategy scanner automatically at custom intervals.</p>
            </div>
            
            <button
              onClick={handleToggleAutoScan}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                isAutoScanning
                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 animate-pulse"
                  : "bg-gray-950 border-borderClr/50 text-gray-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isAutoScanning ? "ACTIVE" : "PAUSED"}</span>
            </button>
          </div>

          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 font-bold">Scanning Interval:</span>
              <select
                value={autoScanInterval}
                onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
                className="bg-gray-900 border border-borderClr rounded px-2 py-1 text-white text-xs outline-none focus:border-amber-400"
              >
                <option value="10">10 Seconds</option>
                <option value="30">30 Seconds</option>
                <option value="60">1 Minute</option>
                <option value="300">5 Minutes</option>
              </select>
            </div>

            {isAutoScanning && (
              <div className="flex items-center justify-between bg-gray-950/60 p-2.5 rounded-lg border border-borderClr/20 text-[11px]">
                <span className="text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400" /> Scanning in:</span>
                <span className="font-extrabold text-amber-400 tracking-wider text-xs">{nextScanSec}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Create Alert Rules Form */}
        <div id="create-rule-form-section" className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-4 bg-gray-950/40">
          <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-borderClr/20 pb-2 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-amber-400" />
            {editingRuleId ? "Modify Alert Rule" : "Create Alert Rule"}
          </span>

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Strategy Type</span>
              <select
                value={alertStrategyType}
                onChange={(e) => setAlertStrategyType(e.target.value)}
                className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400 outline-none"
              >
                <option value="ALL">All Strategies</option>
                <option value="1:3:2">1:3:2 Ratio Butterfly (All)</option>
                <option value="1:3:2 CALL RATIO FLY">1:3:2 Call Ratio Fly</option>
                <option value="1:3:2 PUT RATIO FLY">1:3:2 Put Ratio Fly</option>
                <option value="IRON CONDOR">Iron Condor</option>
                <option value="RATIO IRON CONDOR (1:2)">Ratio Iron Condor (1:2)</option>
                <option value="IRON BUTTERFLY">Iron Butterfly</option>
                <option value="1:2 PUT RATIO SPREAD">1:2 Put Ratio Spread</option>
                <option value="1:2 CALL RATIO SPREAD">1:2 Call Ratio Spread</option>
                <option value="HEDGED SHORT STRANGLE">Hedged Short Strangle</option>
                <option value="COVERED CALL">Covered Call</option>
                <option value="COVERED PUT">Covered Put</option>
                <option value="PROTECTIVE PUT">Protective Put (Married Put)</option>
                <option value="ZERO COST COLLAR">Zero-Cost Collar</option>
                <option value="PUT SPREAD COLLAR">Put Spread Collar</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Underlying Symbol</span>
              <select
                value={alertSymbol}
                onChange={(e) => setAlertSymbol(e.target.value)}
                className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400 outline-none"
              >
                {symbolOptions.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym === "ALL_NSE" ? "All NSE Stocks" : (sym === "ALL" ? "Any Symbol" : sym)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Expiry Date</span>
              <select
                value={alertExpiry}
                onChange={(e) => setAlertExpiry(e.target.value)}
                className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400 outline-none"
              >
                <option value="ALL">Any Expiry</option>
                {formExpiries.map((exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Min POP (%)</span>
              <input
                type="number"
                value={alertMinPop}
                onChange={(e) => setAlertMinPop(parseFloat(e.target.value) || 0)}
                className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Min Risk:Reward (1:X)</span>
              <input
                type="number"
                value={alertMinRR}
                onChange={(e) => setAlertMinRR(parseFloat(e.target.value) || 0)}
                className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Min Loss (Currency Val)</span>
                <input
                  type="number"
                  placeholder="0"
                  value={alertMinLoss}
                  onChange={(e) => setAlertMinLoss(parseFloat(e.target.value) || 0)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Max Loss (Currency Val)</span>
                <input
                  type="number"
                  placeholder="3000"
                  value={alertMaxLoss}
                  onChange={(e) => setAlertMaxLoss(parseFloat(e.target.value) || 0)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Min Delta</span>
                <input
                  type="number"
                  placeholder="-∞"
                  value={alertMinDelta}
                  onChange={(e) => setAlertMinDelta(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Max Delta</span>
                <input
                  type="number"
                  placeholder="∞"
                  value={alertMaxDelta}
                  onChange={(e) => setAlertMaxDelta(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Min Theta (Val/day)</span>
              <input
                type="number"
                placeholder="No limit"
                value={alertMinTheta}
                onChange={(e) => setAlertMinTheta(e.target.value)}
                className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Max Gamma</span>
              <input
                type="number"
                step="0.0001"
                placeholder="No limit"
                value={alertMaxGamma}
                onChange={(e) => setAlertMaxGamma(e.target.value)}
                className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex flex-col gap-1 text-left">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Take Profit (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={alertTakeProfit}
                  onChange={(e) => setAlertTakeProfit(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="bg-gray-900 border border-borderClr rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex flex-col gap-1 text-left">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Stop Loss (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={alertStopLoss}
                  onChange={(e) => setAlertStopLoss(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="bg-gray-900 border border-borderClr rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-gray-900/60 p-2.5 rounded-lg border border-borderClr/25 mt-1">
              <input
                type="checkbox"
                id="alertAutoExecute"
                checked={alertAutoExecute}
                onChange={(e) => setAlertAutoExecute(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-amber-500 bg-gray-900 border-borderClr accent-amber-500 cursor-pointer"
              />
              <div className="flex flex-col text-left cursor-pointer" onClick={() => setAlertAutoExecute(!alertAutoExecute)}>
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Auto-Execute on Match</span>
                <span className="text-[8px] text-gray-500 leading-tight">Submit matching strategies directly to paper portfolios.</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddAlertRule}
                className="mt-2 flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                {editingRuleId ? "Update Alert Rule" : <>
                  <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                  Create Alert Rule
                </>}
              </button>
              {editingRuleId && (
                <button
                  onClick={() => {
                    setEditingRuleId(null);
                    setAlertMinDelta("");
                    setAlertMaxDelta("");
                    setAlertMinTheta("");
                    setAlertMaxGamma("");
                    setAlertAutoExecute(false);
                    setAlertTakeProfit(20);
                    setAlertStopLoss(0);
                  }}
                  className="mt-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg text-xs transition-all border border-borderClr"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notification Channel Panel */}
        <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-4 bg-gray-950/40">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-borderClr/20 pb-2">
            Notification Settings
          </span>

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Alert Channel</span>
              <select
                value={notificationChannel}
                onChange={(e) => setNotificationChannel(e.target.value)}
                className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-400"
              >
                <option value="muted">Muted (No External Alerts)</option>
                <option value="web_only">Web Only (Chime + Banner)</option>
                <option value="sms">SMS Phone Alerts</option>
                <option value="whatsapp">WhatsApp Alerts</option>
                <option value="telegram">Telegram Bot Alerts</option>
                <option value="email">Gmail / Email Alerts</option>
                <option value="both">Both (SMS + Telegram)</option>
              </select>
            </div>

            {(notificationChannel === "sms" || notificationChannel === "both") && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">SMS Phone Override</span>
                <input
                  type="text"
                  placeholder="e.g. +919999999999"
                  value={alertPhoneOverride}
                  onChange={(e) => setAlertPhoneOverride(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none"
                />
              </div>
            )}

            {notificationChannel === "whatsapp" && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">WhatsApp Number</span>
                <input
                  type="text"
                  placeholder="e.g. +919999999999"
                  value={alertWhatsappOverride}
                  onChange={(e) => setAlertWhatsappOverride(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none"
                />
              </div>
            )}

            {notificationChannel === "email" && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Recipient Email</span>
                <input
                  type="email"
                  placeholder="e.g. name@gmail.com"
                  value={alertRecipientEmail}
                  onChange={(e) => setAlertRecipientEmail(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none"
                />
              </div>
            )}

            {(notificationChannel === "telegram" || notificationChannel === "both") && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Telegram Bot Token</span>
                  <input
                    type="password"
                    placeholder="e.g. 123456789:ABC..."
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Telegram Chat ID</span>
                  <input
                    type="text"
                    placeholder="e.g. -10012345678 or 123456"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Rules list */}
        <div className="glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-4 bg-gray-950/40">
          <div className="flex justify-between items-center border-b border-borderClr/20 pb-1">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Active Rules ({alertRules.length})</span>
            {alertRules.length > 0 && (
              <button
                onClick={handleDeleteAllAlertRules}
                className="text-[9px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider bg-red-950/40 border border-red-500/20 hover:border-red-500/50 rounded px-1.5 py-0.5 cursor-pointer"
              >
                Delete All
              </button>
            )}
          </div>
          {alertRules.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500 border border-dashed border-borderClr/30 rounded-xl bg-gray-950/20">
              No active alert rules. Create one using the form above.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {alertRules.map(rule => {
                const cur = getCurrencySymbol(rule.symbol === 'ALL' || rule.symbol === 'ALL_NSE' ? symbol : rule.symbol);
                return (
                  <div key={rule.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-950 border border-borderClr/40 text-xs hover:border-amber-400/50 transition-all">
                    <div 
                      onClick={() => handleSelectRuleTriggers(rule.id)}
                      title="Click to load latest triggered payoff graph for this rule"
                      className="flex flex-col gap-0.5 text-left cursor-pointer flex-1"
                    >
                      <span className="font-bold text-white hover:text-amber-400 transition-colors">
                        {rule.strategyType === '1:3:2' ? '1:3:2 Ratio Butterfly' : getStrategyLabel(rule.strategyType)}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Symbol: {rule.symbol === 'ALL' ? 'Any' : (rule.symbol === 'ALL_NSE' ? 'All NSE Stocks' : rule.symbol)} | Expiry: {rule.expiry === 'ALL' ? 'Any' : rule.expiry} | POP ≥ {rule.minPop}% | R:R ≥ 1:{rule.minRR} | Loss Range: {rule.minLoss != null && rule.minLoss > 0 ? `${cur}${rule.minLoss.toLocaleString()} - ` : ""}{cur}{rule.maxLoss.toLocaleString()}
                        {(rule.minDelta !== undefined || rule.maxDelta !== undefined) && ` | Delta: [${rule.minDelta ?? '-∞'}, ${rule.maxDelta ?? '∞'}]`}
                        {rule.minTheta !== undefined && ` | Theta ≥ +${cur}${rule.minTheta}`}
                        {rule.maxGamma !== undefined && ` | Gamma ≤ ${rule.maxGamma}`}
                        {rule.takeProfit !== undefined && ` | TP: ${rule.takeProfit}%`}
                        {rule.stopLoss !== undefined && ` | SL: ${rule.stopLoss}%`}
                        {rule.autoExecute && ` | Auto-Exec: Yes`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleAlertRule(rule.id)}
                        title={rule.active ? "Pause rule scanning" : "Activate rule scanning"}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase transition-all border ${
                          rule.active
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                            : "bg-gray-900 border-borderClr text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {rule.active ? "Active" : "Paused"}
                      </button>
                      <button
                        onClick={() => handleEditAlertRule(rule)}
                        title="Edit alert rule"
                        className={`p-1 rounded transition-all ${
                          editingRuleId === rule.id
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            : "text-gray-500 hover:text-amber-400 hover:bg-gray-800"
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveAlertRule(rule.id)}
                        className="p-1 text-gray-500 hover:text-redBrand hover:bg-gray-800 rounded transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Log & Triggered Details */}
      <div className="xl:col-span-2 flex flex-col gap-6">
        {/* Split grid for triggers list and detailed view */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
           {/* Triggers Log list (Col Span 2) */}
          {!isLogCollapsed && (
            <div className="md:col-span-2 glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-4 h-[670px] bg-gray-950/40">
              <div className="flex items-center justify-between border-b border-borderClr/20 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider text-left">Trigger Log</h3>
                  <p className="text-[9px] text-gray-500 text-left">History of matched options trades.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {triggeredAlerts.length > 0 && (
                    <button
                      onClick={handleClearTriggers}
                      className="text-[9px] font-extrabold text-redBrand hover:underline uppercase tracking-wider"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setIsLogCollapsed(true)}
                    title="Collapse Trigger Log"
                    className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-white transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
                {triggeredAlerts.length === 0 ? (
                  <div className="text-center py-16 text-xs text-gray-500 flex flex-col items-center gap-2">
                    <Bell className="w-8 h-8 text-gray-600 animate-bounce" />
                    <span>No alerts triggered yet. Active scans will print here.</span>
                  </div>
                ) : (
                  triggeredAlerts.slice(0, 30).map(trig => {
                    const isSelected = selectedAlert?.id === trig.id;
                    const pnl = getAlertCurrentPnL(trig);
                    return (
                      <div
                        key={trig.id}
                        onClick={() => {
                          setSelectedAlert(trig);
                          setAlertDaysPassed(0);
                          setAlertIvOffset(0);
                        }}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex flex-col gap-1.5 ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500"
                            : "bg-gray-950/60 border-borderClr/30 hover:border-gray-500"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-white text-xs">
                            {trig.symbol} <span className="text-[9px] text-accentCyan font-extrabold">({trig.expiry})</span>
                          </span>
                          <span className="text-[9px] text-gray-500">{trig.timestamp}</span>
                        </div>
                        <span className="text-[11px] font-bold text-gray-300">{trig.strategyName.split(" (")[0]}</span>
                        <div className="flex flex-wrap items-center justify-between gap-1 mt-1 text-[9px] text-gray-400">
                          <span>POP: <strong className="text-greenBrand">{trig.pop}%</strong></span>
                          <span>R:R: <strong className="text-white">1:{trig.rrRatio.toFixed(1)}</strong></span>
                          {trig.delta !== undefined && <span>Delta: <strong className="text-white">{trig.delta > 0 ? "+" : ""}{trig.delta}</strong></span>}
                          {trig.theta !== undefined && <span>Theta: <strong className="text-greenBrand">+{trig.theta}</strong></span>}
                        </div>
                        <div className="flex justify-between items-center mt-1 border-t border-borderClr/10 pt-1 text-[10px]">
                          <span className="text-gray-400 font-semibold">Live P&L:</span>
                          <strong className={pnl >= 0 ? "text-greenBrand" : "text-redBrand"}>
                            {pnl >= 0 ? "+" : ""}{getCurrencySymbol(trig.symbol)}{pnl.toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Detailed Selected View (Col Span 3 or 5) */}
          <div className={`${isLogCollapsed ? "md:col-span-5" : "md:col-span-3"} glass-panel rounded-xl p-5 border border-borderClr/30 flex flex-col gap-4 h-[670px] overflow-y-auto bg-gray-950/40`}>
            {!selectedAlert ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-xs text-gray-500">
                {isLogCollapsed && (
                  <button
                    onClick={() => setIsLogCollapsed(false)}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-borderClr/60 text-white font-bold rounded-lg transition-all flex items-center gap-1.5"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>Expand Trigger Log</span>
                  </button>
                )}
                <span>Select a triggered alert from the log list to inspect its legs details, payoff chart, and F&O execution parameters.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-5 text-xs">
                {/* Header card with trade execution trigger */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-950/70 p-4 rounded-xl border border-borderClr/15 text-left">
                  <div className="flex items-center gap-3">
                    {isLogCollapsed && (
                      <button
                        onClick={() => setIsLogCollapsed(false)}
                        title="Expand Trigger Log"
                        className="p-1.5 rounded-lg bg-gray-900 border border-borderClr/40 text-gray-400 hover:text-white hover:border-gray-500 transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-accentCyan uppercase tracking-widest">{selectedAlert.symbol} • EXPIRY {selectedAlert.expiry}</span>
                      <h2 className="text-sm font-extrabold text-white">{selectedAlert.strategyName.split(" (")[0]}</h2>
                      <span className="text-[10px] text-gray-500">Triggered at {selectedAlert.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 self-start md:self-center">
                    <button
                      onClick={() => {
                        const normalizedLegs = normalizeLegQuantities(selectedAlert.legs, selectedAlert.symbol);
                        setPayoffModalData({
                          legs: normalizedLegs,
                          spot: alertSpotPrice,
                          expiry: selectedAlert.expiry,
                          symbol: selectedAlert.symbol,
                          name: selectedAlert.strategyName
                        });
                        setPayoffModalOpen(true);
                      }}
                      className="px-4 py-2 bg-accentCyan/10 hover:bg-accentCyan/20 border border-accentCyan/30 text-accentCyan font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5"
                    >
                      <TrendingUp className="w-3.5 h-3.5 stroke-[3px]" />
                      <span>Payoff</span>
                    </button>

                    {user?.role !== 'viewer' ? (
                      <button
                        onClick={() => setTradeModalOpen(true)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold rounded-lg text-xs transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-black text-black stroke-[3px]" />
                        Trade Alert
                      </button>
                    ) : (
                      <span className="text-[9px] font-extrabold text-redBrand uppercase bg-redBrand/10 px-2 py-1 rounded border border-redBrand/20 flex items-center">Viewer (Locked)</span>
                    )}
                  </div>
                </div>

                {/* Metrics Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-left">
                  {(() => {
                    const cur = getCurrencySymbol(selectedAlert.symbol);
                    return (
                      <>
                        <div className="bg-gray-950/40 p-2.5 rounded-lg border border-borderClr/20 flex flex-col">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Prob. of Profit</span>
                          <span className="text-sm font-extrabold text-greenBrand mt-0.5">{selectedAlert.pop}%</span>
                        </div>
                        <div className="bg-gray-950/40 p-2.5 rounded-lg border border-borderClr/20 flex flex-col">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Risk:Reward</span>
                          <span className="text-sm font-extrabold text-white mt-0.5">1:{selectedAlert.rrRatio.toFixed(1)}</span>
                        </div>
                        <div className="bg-gray-950/40 p-2.5 rounded-lg border border-borderClr/20 flex flex-col">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Max Profit</span>
                          <span className="text-sm font-extrabold text-greenBrand mt-0.5">
                            {typeof selectedAlert.maxProfit === 'number' ? `${cur}${selectedAlert.maxProfit.toLocaleString()}` : String(selectedAlert.maxProfit)}
                          </span>
                        </div>
                        <div className="bg-gray-950/40 p-2.5 rounded-lg border border-borderClr/20 flex flex-col">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Max Loss</span>
                          <span className="text-sm font-extrabold text-redBrand mt-0.5">
                            {typeof selectedAlert.maxLoss === 'number' ? `${cur}${selectedAlert.maxLoss.toLocaleString()}` : String(selectedAlert.maxLoss)}
                          </span>
                        </div>
                        <div className="bg-gray-950/40 p-2.5 rounded-lg border border-borderClr/20 flex flex-col">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Live Spot</span>
                          <span className="text-sm font-extrabold text-white mt-0.5">{cur}{alertSpotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className={`p-2.5 rounded-lg border flex flex-col ${selectedPnL >= 0 ? "bg-greenBrand/10 border-greenBrand/25" : "bg-redBrand/10 border-redBrand/25"}`}>
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Live P&L</span>
                          <span className={`text-sm font-extrabold mt-0.5 ${selectedPnL >= 0 ? "text-greenBrand" : "text-redBrand"}`}>
                            {selectedPnL >= 0 ? "+" : ""}{cur}{selectedPnL.toLocaleString()}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Greeks Metrics Stats Row */}
                <div className="grid grid-cols-3 gap-3 text-left bg-gray-950/20 p-3.5 rounded-xl border border-borderClr/15">
                  {(() => {
                    const cur = getCurrencySymbol(selectedAlert.symbol);
                    return (
                      <>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Strategy Delta (Δ)</span>
                          <strong className="text-xs text-white mt-0.5">{selectedAlert.delta !== undefined ? (selectedAlert.delta > 0 ? "+" : "") + selectedAlert.delta : "N/A"}</strong>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Strategy Gamma (Γ)</span>
                          <strong className="text-xs text-white mt-0.5">{selectedAlert.gamma !== undefined ? selectedAlert.gamma.toFixed(5) : "N/A"}</strong>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Strategy Theta (Θ)</span>
                          <strong className="text-xs text-greenBrand mt-0.5">{selectedAlert.theta !== undefined ? `+${cur}${selectedAlert.theta}/day` : "N/A"}</strong>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Details of Legs */}
                <div className="flex flex-col gap-2 bg-gray-950/30 p-3.5 rounded-xl border border-borderClr/15 text-left">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider border-b border-borderClr/10 pb-1">
                    Details of Strategy Legs
                  </span>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead>
                        <tr className="border-b border-borderClr/20 text-gray-500">
                          <th className="py-1.5">Action</th>
                          <th className="py-1.5">Qty</th>
                          <th className="py-1.5">Option</th>
                          <th className="py-1.5">Strike</th>
                          <th className="py-1.5">Entry Price</th>
                          <th className="py-1.5 text-right">IV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAlert.legs.map((leg, index) => {
                          const isBuy = leg.action === 'BUY';
                          const typeChar = leg.optionType === 'C' ? 'Call' : leg.optionType === 'P' ? 'Put' : 'Future';
                          const cur = getCurrencySymbol(selectedAlert.symbol);
                          return (
                            <tr key={leg.id || index} className="border-b border-borderClr/10 text-gray-300">
                              <td className={`py-1.5 font-bold ${isBuy ? 'text-greenBrand' : 'text-redBrand'}`}>{leg.action}</td>
                              <td className="py-1.5">{leg.quantity}</td>
                              <td className="py-1.5">{typeChar}</td>
                              <td className="py-1.5 font-bold text-white">{cur}{leg.strike.toLocaleString()}</td>
                              <td className="py-1.5">{cur}{leg.entryPrice}</td>
                              <td className="py-1.5 text-right text-accentCyan">{(leg.iv * 100).toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payoff Chart Curve block */}
                <div className="flex flex-col gap-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Payoff Curve (Simulation)</span>
                    <div className="flex gap-3 text-[9px] text-gray-500 font-semibold">
                      <span className="flex items-center gap-1"><span className="w-2 h-1 bg-accentCyan rounded-full" /> T+{alertDaysPassed}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-1 bg-purple-500 rounded-full" /> Expiry</span>
                    </div>
                  </div>

                  {/* Render compact Recharts curve */}
                  <div className="glass-panel rounded-xl p-2.5 h-[180px] bg-gray-950/60 relative">
                    {payoffData.payoff.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={payoffData.payoff} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <XAxis
                            type="number"
                            dataKey="price"
                            domain={['dataMin', 'dataMax']}
                            stroke="#4b5563"
                            fontSize={9}
                            tickFormatter={(value) => value != null && !isNaN(value) ? Math.round(value).toLocaleString() : ""}
                          />
                          <YAxis stroke="#4b5563" fontSize={9} />
                          <Tooltip content={<CustomTooltip />} />
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" />
                          {alertSpotPrice != null && !isNaN(alertSpotPrice) && isFinite(alertSpotPrice) && (
                            <ReferenceLine x={alertSpotPrice} stroke="#6366F1" strokeDasharray="3 3" label={{ value: 'Spot', fill: '#818CF8', fontSize: 9, position: 'top' }} />
                          )}
                          {payoffData.metrics?.breakEvens?.filter((be: any) => be != null && !isNaN(be) && isFinite(be)).map((be: any) => (
                            <ReferenceLine
                              key={be}
                              x={be}
                              stroke="#EAB308"
                              strokeDasharray="2 2"
                              strokeWidth={1}
                              label={{ value: `BE: ${Math.round(be)}`, fill: '#F59E0B', fontSize: 8, position: 'bottom' }}
                            />
                          ))}
                          <Area type="monotone" dataKey="pnlCurrent" stroke="#00f0ff" strokeWidth={1.5} fill="none" />
                          <Area type="monotone" dataKey="pnlExpiration" stroke="#a855f7" strokeWidth={1.5} fill="none" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-600 text-xs">No payoff details.</div>
                    )}
                  </div>

                  {/* Sliders */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-gray-400 font-bold">
                        <span>Target Date: T+{alertDaysPassed} Days</span>
                        <span>Max {totalDays}d</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={totalDays}
                        value={alertDaysPassed}
                        onChange={(e) => setAlertDaysPassed(parseInt(e.target.value))}
                        className="w-full accent-accentCyan bg-gray-900 border border-borderClr h-1 rounded cursor-pointer"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-gray-400 font-bold">
                        <span>IV Shift: {alertIvOffset >= 0 ? "+" : ""}{(alertIvOffset * 100).toFixed(0)}%</span>
                        <span>Range ±15%</span>
                      </div>
                      <input
                        type="range"
                        min="-0.15"
                        max="0.15"
                        step="0.01"
                        value={alertIvOffset}
                        onChange={(e) => setAlertIvOffset(parseFloat(e.target.value))}
                        className="w-full accent-accentCyan bg-gray-900 border border-borderClr h-1 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trade Execution Modal Dialog */}
      {tradeModalOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-borderClr/40 p-6 flex flex-col gap-5 bg-gray-950">
            <div className="flex items-center justify-between border-b border-borderClr/20 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Execute Options Trade</h3>
              <button 
                onClick={() => setTradeModalOpen(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs text-left">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Broker Account</span>
                <select
                  value={selectedBroker}
                  onChange={(e: any) => setSelectedBroker(e.target.value)}
                  className="bg-gray-900 border border-borderClr rounded px-2.5 py-1.5 text-white text-xs outline-none focus:border-emerald-400"
                >
                  <option value="paper">Paper Trading (Simulated Account)</option>
                  <option value="delta_demo">Delta Exchange Demo (Demo/Testnet API)</option>
                  <option value="delta_live">Delta Exchange Live (Live API)</option>
                </select>
              </div>

              <div className="bg-gray-900 p-3 rounded-lg border border-borderClr/20 text-gray-400">
                <span className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Strategy Summary</span>
                <strong>{selectedAlert.symbol}</strong> • {selectedAlert.strategyName.split(" (")[0]}
                <span className="block mt-1 text-[11px]">Expiry: {selectedAlert.expiry} • POP: {selectedAlert.pop}%</span>
              </div>

              {(selectedBroker === 'delta_demo' || selectedBroker === 'delta_live') && executionConfig ? (
                (() => {
                  const isLive = selectedBroker === 'delta_live';
                  const networkConfig = isLive ? (executionConfig as any).live : (executionConfig as any).demo;
                  const isSandbox = networkConfig?.mode === 'sandbox_simulation';

                  return (
                    <div className={`p-3 rounded-lg text-[11px] border ${
                      isSandbox
                        ? "bg-blue-500/10 border-blue-500/25 text-blue-300"
                        : isLive
                          ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
                          : "bg-green-500/10 border-green-500/25 text-green-300"
                    }`}>
                      {isSandbox ? (
                        <span>ℹ️ Delta Exchange ({isLive ? "Live" : "Demo"}) is running in <strong>Sandbox Simulation Mode</strong>. Order requests are logged locally in the backend without placing real trades.</span>
                      ) : isLive ? (
                        <span>⚠️ Live executions immediately submit real orders to Delta Exchange. Verify your live API credentials.</span>
                      ) : (
                        <span>ℹ️ Demo execution submits orders to the Delta Exchange Demo (testnet) environment. Verify your demo API credentials.</span>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg text-[11px] text-amber-300">
                  ⚠️ Paper trade results are recorded locally for strategy validation.
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={() => setTradeModalOpen(false)}
                className="px-4 py-2 border border-borderClr/50 rounded-lg text-xs font-bold hover:text-white transition-all"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isExecutingTrade}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold rounded-lg text-xs transition-all flex items-center gap-1.5"
              >
                {isExecutingTrade ? "Placing orders..." : "Place Orders"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payoff Modal */}
      {payoffModalOpen && payoffModalData && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-panel max-w-4xl w-full rounded-2xl border border-borderClr/40 p-6 flex flex-col gap-5 shadow-2xl bg-gray-950/95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-borderClr/25 pb-3">
              <div className="flex flex-col gap-1.5 text-left">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-left">
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
    </div>
  );
};
