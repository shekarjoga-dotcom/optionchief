import React, { useEffect, useState, useRef } from 'react';
import { useStore } from './hooks/useStore';
import { SymbolSelector } from './components/SymbolSelector';
import { ExpirySelector } from './components/ExpirySelector';
import { OptionChainTable } from './components/OptionChainTable';
import { LegManager } from './components/LegManager';
import { PayoffChart } from './components/PayoffChart';
import { VolatilityCone } from './components/VolatilityCone';
import { ScannerPanel } from './components/ScannerPanel';
import { AlertsPanel } from './components/AlertsPanel';
import { BacktesterPanel } from './components/BacktesterPanel';
import { PortfolioManager } from './components/PortfolioManager';
import { HedgingAdvisor } from './components/HedgingAdvisor';
import { LoginView } from './components/LoginView';
import { HelpPanel } from './components/HelpPanel';
import {
  TrendingUp,
  Layers,
  BarChart2,
  Briefcase,
  Activity,
  AlertCircle,
  Search,
  User,
  Bell,
  History,
  HelpCircle
} from 'lucide-react';
import { scanStrategies } from './utils/scanner';
import { getLotSizeForSymbol, getCurrencySymbol } from './utils/optionsMath';

import { BACKEND_URL } from './config';

const App: React.FC = () => {
  const { 
    symbol,
    alertRules,
    isAutoScanning,
    autoScanInterval,
    fetchMarketData, 
    fetchPortfolios, 
    error, 
    token, 
    user, 
    isAuthLoading, 
    checkAuthSession, 
    logout,
    triggeredAlerts,
    fetchTriggeredAlerts
  } = useStore();
  
  const symbolRef = useRef(symbol);
  const alertRulesRef = useRef(alertRules);

  const [activeTab, setActiveTab] = useState<'chain' | 'scanner' | 'alerts' | 'backtest' | 'builder' | 'cone' | 'portfolios' | 'help'>('chain');
  const [backgroundNotification, setBackgroundNotification] = useState<string | null>(null);
  const [marketTickers, setMarketTickers] = useState<any[]>([]);
  const [businessNews, setBusinessNews] = useState<any[]>([]);

  const seenAlertIdsRef = useRef<Set<string>>(new Set());

  // Poll backend triggered alerts every 5 seconds
  useEffect(() => {
    if (!token || !user || !isAutoScanning) return;
    fetchTriggeredAlerts();
    const interval = setInterval(fetchTriggeredAlerts, 5000);
    return () => clearInterval(interval);
  }, [token, user, isAutoScanning]);

  // Monitor changes in triggeredAlerts to fire sound & notify
  useEffect(() => {
    if (!triggeredAlerts) return;
    if (triggeredAlerts.length === 0) {
      seenAlertIdsRef.current.clear();
      return;
    }

    // On first load, populate seen list so we don't spam historical alerts
    if (seenAlertIdsRef.current.size === 0) {
      triggeredAlerts.forEach(a => seenAlertIdsRef.current.add(a.id));
      return;
    }

    // Filter out unseen alerts
    const newAlerts = triggeredAlerts.filter(a => !seenAlertIdsRef.current.has(a.id));
    if (newAlerts.length > 0) {
      // Add all new IDs to seen ref
      newAlerts.forEach(a => seenAlertIdsRef.current.add(a.id));
      
      // Play sound
      playAlertSound();
      
      // Notify
      const latest = newAlerts[0];
      setBackgroundNotification(`🔔 Backend Alert: Found ${latest.strategyName} for ${latest.symbol}!`);
      setTimeout(() => setBackgroundNotification(null), 6000);
    }
  }, [triggeredAlerts]);

  // Fetch market tickers on load & periodically
  useEffect(() => {
    if (!token || !user) return;
    const fetchTickers = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/market/ticker-prices`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.tickers) {
            setMarketTickers(data.tickers);
          }
        }
      } catch (e) {
        console.error("Error fetching ticker prices:", e);
      }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 45000); // refresh every 45s
    return () => clearInterval(interval);
  }, [token, user]);

  // Fetch business news on load & periodically
  useEffect(() => {
    if (!token || !user) return;
    const fetchNews = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/market/news`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.news) {
            setBusinessNews(data.news);
          }
        }
      } catch (e) {
        console.error("Error fetching business news feed:", e);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 120000); // refresh news every 2 minutes
    return () => clearInterval(interval);
  }, [token, user]);

  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  useEffect(() => {
    alertRulesRef.current = alertRules;
  }, [alertRules]);



  // Verify session on component mount
  useEffect(() => {
    checkAuthSession();
  }, []);

  // Fetch data only after the session has been validated and token is set
  useEffect(() => {
    if (token && user) {
      fetchMarketData();
      fetchPortfolios();
    }
  }, [token, user]);

  const playAlertSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (err) {
      console.error("Web Audio alert sound failed:", err);
    }
  };

  // Background scanning loop
  useEffect(() => {
    if (!isAutoScanning || !token || !user) return;

    let isMounted = true;
    let timerId: any = null;

    const runBackgroundScan = async () => {
      try {
        const currentRules = alertRulesRef.current;
        const activeRules = currentRules.filter((r: any) => r.active);
        if (activeRules.length === 0) return;

        // Get all unique symbols from active rules plus the current symbol
        const symbolsToScan = new Set<string>();
        activeRules.forEach((r: any) => {
          if (r.symbol && r.symbol !== "ALL") {
            symbolsToScan.add(r.symbol.toUpperCase());
          }
        });
        
        // Always include current symbol to ensure active tab asset is scanned
        const currentSymbol = symbolRef.current;
        symbolsToScan.add(currentSymbol.toUpperCase());

        const expandedSymbols: string[] = [];
        symbolsToScan.forEach(s => {
          if (s === "ALL_NSE") {
            const constituents = ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "SBIN", "ITC", "BHARTIARTL", "LT", "AXISBANK"];
            constituents.forEach(c => {
              if (!expandedSymbols.includes(c)) expandedSymbols.push(c);
            });
          } else {
            if (!expandedSymbols.includes(s)) expandedSymbols.push(s);
          }
        });

        for (const scanSymbol of expandedSymbols) {
          // 2. Fetch underlying spot price first
          const chainRes = await fetch(`${BACKEND_URL}/api/market/option-chain?symbol=${scanSymbol}`);
          if (!chainRes.ok || !isMounted) continue;
          const chainData = await chainRes.json();
          if (!chainData.underlying || !chainData.underlying.spot) continue;
          const currentSpot = chainData.underlying.spot;

          // Get scan parameters from localStorage
          const minWingWidth = parseInt(localStorage.getItem("options_oracle_scanner_min_wing") || "1");
          const maxWingWidth = parseInt(localStorage.getItem("options_oracle_scanner_max_wing") || "4");
          const minDist = parseInt(localStorage.getItem("options_oracle_scanner_min_dist") || "1");
          const maxDist = parseInt(localStorage.getItem("options_oracle_scanner_max_dist") || "20");
          const scanStep = parseInt(localStorage.getItem("options_oracle_scanner_step") || "1");
          const riskFreeRate = parseFloat(localStorage.getItem("options_oracle_scanner_rfr") || "6.0");
          const lotSize = getLotSizeForSymbol(scanSymbol);
          
          const expiriesSaved = localStorage.getItem("options_oracle_scanner_selected_expiries");
          let expiriesToScan = expiriesSaved ? JSON.parse(expiriesSaved) : [];
          
          // Ensure we scan expiries that are explicitly requested by active alert rules
          activeRules.forEach((r: any) => {
            if (r.expiry && r.expiry !== "ALL" && chainData.expiry_dates.includes(r.expiry)) {
              if (!expiriesToScan.includes(r.expiry)) {
                expiriesToScan.push(r.expiry);
              }
            }
          });

          // Filter out any stale/non-existing expiries
          expiriesToScan = expiriesToScan.filter((exp: string) => chainData.expiry_dates.includes(exp));
          if (expiriesToScan.length === 0) {
            expiriesToScan = chainData.expiry_dates.slice(0, 1); // default to first expiry
          }

          // Determine all strategy types we need to scan for this symbol
          const strategyTypes = new Set<string>();
          activeRules.forEach((r: any) => {
            if (r.symbol !== "ALL" && r.symbol.toUpperCase() !== scanSymbol) return;
            if (r.strategyType === "ALL") {
              const allTypes = ["IRON CONDOR", "IRON BUTTERFLY", "BULL PUT SPREAD", "BEAR CALL SPREAD", "CALL BUTTERFLY", "PUT BUTTERFLY", "1:3:2 CALL RATIO FLY", "1:3:2 PUT RATIO FLY", "HEDGED SHORT STRANGLE"];
              allTypes.forEach(t => strategyTypes.add(t));
            } else if (r.strategyType === "1:3:2") {
              strategyTypes.add("1:3:2 CALL RATIO FLY");
              strategyTypes.add("1:3:2 PUT RATIO FLY");
            } else {
              strategyTypes.add(r.strategyType);
            }
          });

          if (strategyTypes.size === 0) continue;

          // Fetch options for each expiry and run scanner
          let allScans: any[] = [];

          for (const exp of expiriesToScan) {
            if (!isMounted) return;
            // Fetch option chain for this expiry
            const expRes = await fetch(`${BACKEND_URL}/api/market/option-chain?symbol=${scanSymbol}&expiry=${exp}`);
            if (!expRes.ok) continue;
            const expData = await expRes.json();
            const expOptions = expData.options;

            for (let w = minWingWidth; w <= maxWingWidth; w++) {
              for (const t of Array.from(strategyTypes)) {
                const res = scanStrategies(
                  t,
                  expOptions,
                  currentSpot,
                  exp,
                  w,
                  minDist,
                  maxDist,
                  scanStep,
                  lotSize,
                  riskFreeRate / 100.0,
                  scanSymbol
                );
                allScans = [...allScans, ...res];
              }
            }
          }

          // Match against alert rules
          const newTriggers: any[] = [];
          allScans.forEach(scan => {
            activeRules.forEach((rule: any) => {
              if (rule.symbol !== "ALL" && rule.symbol.toUpperCase() !== scanSymbol) return;
              
              const typeMatch = rule.strategyType === 'ALL' || 
                scan.name.toUpperCase().includes(rule.strategyType.toUpperCase()) ||
                (rule.strategyType === '1:3:2' && scan.name.toUpperCase().includes('1:3:2'));
              
              if (!typeMatch) return;
              
              // Match POP
              const popMatch = scan.pop >= rule.minPop;
              
              // Match Risk-Reward
              let rrRatio = 0;
              if (typeof scan.maxLoss === 'number' && typeof scan.maxProfit === 'number' && scan.maxLoss !== 0) {
                rrRatio = Math.abs(scan.maxProfit) / Math.abs(scan.maxLoss);
              } else if (scan.maxProfit === 'Unlimited') {
                rrRatio = 999;
              }
              const rrMatch = rrRatio >= rule.minRR;
              
              // Match Max Loss
              let lossMatch = false;
              if (rule.maxLoss <= 0) {
                lossMatch = true;
              } else if (typeof scan.maxLoss === 'number') {
                const minLossVal = rule.minLoss != null ? rule.minLoss : 0;
                lossMatch = Math.abs(scan.maxLoss) >= minLossVal && Math.abs(scan.maxLoss) <= rule.maxLoss;
              } else if (scan.maxLoss === 'Unlimited') {
                lossMatch = rule.maxLoss >= 100000 || 
                            ['SHORT STRADDLE', 'SHORT STRANGLE', 'LONG STRADDLE', 'LONG STRANGLE'].includes(rule.strategyType.toUpperCase());
              }
              
              // Match Expiry
              const expiryMatch = !rule.expiry || rule.expiry === 'ALL' || scan.expiry === rule.expiry;
              
              // Match Greeks
              const deltaMatch = 
                (rule.minDelta === undefined || rule.minDelta === null || scan.delta >= rule.minDelta) &&
                (rule.maxDelta === undefined || rule.maxDelta === null || scan.delta <= rule.maxDelta);
              const thetaMatch = 
                (rule.minTheta === undefined || rule.minTheta === null || scan.theta >= rule.minTheta);
              const gammaMatch = 
                (rule.maxGamma === undefined || rule.maxGamma === null || scan.gamma <= rule.maxGamma);
              
              if (popMatch && rrMatch && lossMatch && expiryMatch && deltaMatch && thetaMatch && gammaMatch) {
                newTriggers.push({
                  id: Math.random().toString(36).substring(2, 9),
                  symbol: scanSymbol,
                  strategyName: scan.name,
                  expiry: scan.expiry,
                  pop: scan.pop,
                  maxProfit: scan.maxProfit,
                  maxLoss: scan.maxLoss,
                  rrRatio: rrRatio,
                  timestamp: new Date().toLocaleTimeString(),
                  triggeredAt: Date.now(), // Cooldown tracker
                  ruleId: rule.id,
                  legs: scan.legs,
                  spotPrice: currentSpot,
                  delta: scan.delta,
                  gamma: scan.gamma,
                  theta: scan.theta
                });
              }
            });
          });

          if (newTriggers.length > 0 && isMounted) {
            const savedTriggers = localStorage.getItem("options_oracle_triggered_alerts");
            const prevTriggers = savedTriggers ? JSON.parse(savedTriggers) : [];
            
            const uniqueNew: any[] = [];
            newTriggers.forEach(nt => {
              const isDuplicateInNew = uniqueNew.some(u => u.strategyName === nt.strategyName && u.symbol === nt.symbol && u.expiry === nt.expiry);
              const isDuplicateInPrev = prevTriggers.some((p: any) => {
                const isMatch = p.strategyName === nt.strategyName && p.symbol === nt.symbol && p.expiry === nt.expiry;
                if (!isMatch) return false;
                // Mute alerts for 5 minutes (300,000 ms) after triggering
                const pTime = p.triggeredAt || 0;
                return (Date.now() - pTime) < 300000;
              });
              
              if (!isDuplicateInNew && !isDuplicateInPrev) {
                uniqueNew.push(nt);
              }
            });

            if (uniqueNew.length > 0) {
              const updatedTriggers = [...uniqueNew, ...prevTriggers];
              localStorage.setItem("options_oracle_triggered_alerts", JSON.stringify(updatedTriggers));

              playAlertSound();
              
              const latest = uniqueNew[0];
              setBackgroundNotification(`🔔 Alert Triggered for ${latest.symbol}: Found strategy matching your rules!`);
              setTimeout(() => setBackgroundNotification(null), 6000);

              // Dispatch to external channels
              const activeChannel = localStorage.getItem("options_oracle_notification_channel") || "web_only";
              if (activeChannel !== "muted" && activeChannel !== "web_only") {
                const phoneOverride = localStorage.getItem("options_oracle_alert_phone_override") || "";
                const botToken = localStorage.getItem("options_oracle_telegram_bot_token") || "";
                const chatId = localStorage.getItem("options_oracle_telegram_chat_id") || "";
                const whatsappOverride = localStorage.getItem("options_oracle_alert_whatsapp_override") || "";
                const recipientEmail = localStorage.getItem("options_oracle_alert_recipient_email") || "";

                uniqueNew.forEach(async (trig) => {
                  try {
                    const trigCur = getCurrencySymbol(trig.symbol);
                    const maxProfitStr = typeof trig.maxProfit === 'number' ? `${trigCur}${trig.maxProfit.toLocaleString()}` : String(trig.maxProfit);
                    const maxLossStr = typeof trig.maxLoss === 'number' ? `${trigCur}${trig.maxLoss.toLocaleString()}` : String(trig.maxLoss);
                    
                    const payload = {
                      strategy_name: trig.strategyName,
                      symbol: trig.symbol,
                      expiry: trig.expiry,
                      pop: trig.pop,
                      max_profit: maxProfitStr,
                      max_loss: maxLossStr,
                      rr_ratio: trig.rrRatio,
                      timestamp: trig.timestamp,
                      channel: activeChannel,
                      phone_number: phoneOverride || null,
                      telegram_bot_token: botToken || null,
                      telegram_chat_id: chatId || null,
                      whatsapp_number: whatsappOverride || null,
                      recipient_email: recipientEmail || null,
                      current_pnl: `${trigCur}0.00`,
                      spot_price: trig.spotPrice,
                      legs: trig.legs
                    };

                    await fetch(`${BACKEND_URL}/api/notifications/trigger-alert`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { "Authorization": `Bearer ${token}` } : {})
                      },
                      body: JSON.stringify(payload)
                    });
                  } catch (err) {
                    console.error("Background dispatcher failed:", err);
                  }
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Background scan failed:", err);
      }
    };

    // Run first scan immediately
    runBackgroundScan();

    // Schedule regular scan intervals
    timerId = setInterval(runBackgroundScan, autoScanInterval * 1000);

    return () => {
      isMounted = false;
      if (timerId) clearInterval(timerId);
    };
  }, [isAutoScanning, autoScanInterval, token, user]);

  // Loading spinner during startup session verification
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-accentBrand/20 border-t-accentBrand rounded-full animate-spin mb-4" />
        <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Verifying Secure Session...</span>
      </div>
    );
  }

  // Guard the application view with Login/Register screen
  if (!token || !user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-darkBg text-gray-200 pb-12">
      {/* Tickers container */}
      <div className="w-full bg-gray-950 border-b border-borderClr/40 overflow-hidden text-[11px] font-medium tracking-wide">
        {/* Ticker 1: Live Prices */}
        <div className="marquee-container relative border-b border-borderClr/20 py-1 bg-black/30 overflow-hidden flex items-center">
          <div className="absolute left-0 z-10 bg-gray-950 px-2 py-0.5 border-r border-borderClr/30 text-[9px] font-extrabold uppercase text-accentCyan">
            Market Live
          </div>
          <div className="pl-[85px] w-full overflow-hidden flex">
            <div className="animate-marquee-fast whitespace-nowrap">
              {marketTickers.length > 0 ? (
                [...marketTickers, ...marketTickers, ...marketTickers].map((t, idx) => {
                  const isUp = t.change >= 0;
                  const isInd = t.name.includes("Nifty") || t.name.includes("Reliance") || t.name.includes("State Bank") || t.name.includes("ITC");
                  const curSym = isInd ? "₹" : "$";
                  return (
                    <span key={idx} className="inline-flex items-center gap-1.5 mx-4">
                      <span className="text-gray-400 font-bold">{t.name}</span>
                      <span className="text-white font-mono">{curSym}{typeof t.price === 'number' ? t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t.price}</span>
                      <span className={`inline-flex items-center font-bold font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                        {isUp ? '▲' : '▼'} {Math.abs(t.change).toFixed(2)}%
                      </span>
                    </span>
                  );
                })
              ) : (
                <span className="text-gray-500 font-bold px-4">Loading Live Market Ticker Data...</span>
              )}
            </div>
          </div>
        </div>

        {/* Ticker 2: Latest Business News */}
        <div className="marquee-container relative py-1 bg-gradient-to-r from-accentBrand/5 to-accentCyan/5 overflow-hidden flex items-center">
          <div className="absolute left-0 z-10 bg-gray-950 px-2 py-0.5 border-r border-borderClr/30 text-[9px] font-extrabold uppercase text-accentBrand">
            Business News
          </div>
          <div className="pl-[85px] w-full overflow-hidden flex">
            <div className="animate-marquee-slow whitespace-nowrap">
              {businessNews.length > 0 ? (
                [...businessNews, ...businessNews, ...businessNews].map((n, idx) => (
                  <span key={idx} className="inline-flex items-center gap-2 mx-6 border-r border-borderClr/20 pr-6 last:border-none">
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-blue-500/10 text-blue-400 uppercase">{n.source}</span>
                    <span className="text-white font-bold">{n.title}</span>
                    {n.time && <span className="text-gray-500 font-mono text-[9px]">{n.time}</span>}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 font-bold px-4">Loading Latest Business News Feed...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Navigation Bar */}
      <header className="border-b border-borderClr/60 bg-gray-950/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-accentBrand to-accentCyan flex items-center justify-center shadow-lg shadow-accentBrand/20">
              <Activity className="w-4 h-4 text-black stroke-[3px]" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-wider uppercase leading-none">OptionsOracle</h1>
              <span className="text-[10px] text-accentCyan font-bold tracking-widest uppercase">Reborn v2.0</span>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-6 text-xs">
            <button
              onClick={() => setActiveTab('portfolios')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-borderClr/60 hover:border-gray-500 text-gray-300 hover:text-white font-bold transition-all"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Paper Trading Book</span>
            </button>
            
            <div className="flex items-center gap-3 border-l border-borderClr/60 pl-5">
              <div className="flex flex-col items-end">
                <span className="text-[11px] text-white font-semibold flex items-center gap-1">
                  <User className="w-3 h-3 text-gray-500" />
                  {user.phone_number}
                </span>
                <span className={`text-[9px] uppercase tracking-wider font-extrabold ${
                  user.role === 'owner' ? 'text-greenBrand' : 'text-accentCyan'
                }`}>
                  {user.role} Account
                </span>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-lg bg-redBrand/10 border border-redBrand/20 hover:bg-redBrand/30 text-redBrand font-extrabold transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 mt-6 flex flex-col gap-6">
        {/* Floating Notifications Toast */}
        {backgroundNotification && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-amber-500 text-black px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2.5 font-extrabold border border-amber-400 animate-bounce">
            <Bell className="w-5 h-5 animate-pulse" />
            <span>{backgroundNotification}</span>
          </div>
        )}

        {/* Error Notification banner if any */}
        {error && (
          <div className="bg-redBrand/10 border border-redBrand/30 text-redBrand rounded-xl p-3 flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span><strong>Connection Error:</strong> {error}. Make sure the FastAPI backend is running on http://localhost:8000. Showing mock fallbacks.</span>
          </div>
        )}

        {/* Symbol Selector Dashboard */}
        <SymbolSelector />

        {/* Tab Navigation Links */}
        <div className="flex flex-wrap items-center justify-between border-b border-borderClr/40 gap-4">
          <div className="flex gap-2">
            {[
              { id: 'chain', label: 'Option Chain', icon: Layers },
              { id: 'scanner', label: 'Strategy Scanner', icon: Search },
              { id: 'alerts', label: 'Strategy Alerts', icon: Bell },
              { id: 'backtest', label: 'Backtester', icon: History },
              { id: 'builder', label: 'Strategy Analyzer', icon: TrendingUp },
              { id: 'cone', label: 'Volatility Cone', icon: BarChart2 },
              { id: 'portfolios', label: 'Paper Trading Book', icon: Briefcase },
              { id: 'help', label: 'Help & Videos', icon: HelpCircle }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
                    isActive
                      ? "border-accentBrand text-white"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex flex-col gap-6 min-h-[400px]">
          {activeTab === 'chain' && (
            <div className="flex flex-col gap-6">
              <ExpirySelector />
              <OptionChainTable />
            </div>
          )}

          {activeTab === 'scanner' && (
            <ScannerPanel />
          )}

          {activeTab === 'alerts' && (
            <AlertsPanel />
          )}

          {activeTab === 'backtest' && (
            <BacktesterPanel />
          )}

          {activeTab === 'builder' && (
            <div className="flex flex-col gap-6">
              <LegManager />
              <HedgingAdvisor />
              <PayoffChart />
            </div>
          )}

          {activeTab === 'cone' && (
            <VolatilityCone />
          )}

          {activeTab === 'portfolios' && (
            <PortfolioManager />
          )}

          {activeTab === 'help' && (
            <HelpPanel />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
