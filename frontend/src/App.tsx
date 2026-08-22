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
import RsiScannerPanel from './components/RsiScannerPanel';
import { AdminPanel } from './components/AdminPanel';
import { SubscriptionModal } from './components/SubscriptionModal';
import {
  TrendingUp,
  Layers,
  BarChart2,
  Briefcase,
  AlertCircle,
  Search,
  User,
  Bell,
  History,
  HelpCircle,
  Zap,
  Shield,
  Key,
  X,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { scanStrategies } from './utils/scanner';
import { getLotSizeForSymbol, getCurrencySymbol } from './utils/optionsMath';

import { BACKEND_URL } from './config';
import logoImg from './assets/logo.png';

const App: React.FC = () => {
  const { 
    symbol, 
    setSymbol, 
    selectedExpiry, 
    setSelectedExpiry, 
    fetchMarketData, 
    fetchPortfolios,
    alertRules, 
    error, 
    clearError,
    token, 
    user, 
    isAuthLoading, 
    checkAuthSession, 
    logout,
    updateUserProfile,
    triggeredAlerts,
    fetchTriggeredAlerts,
    clearLegs,
    addLeg,
    isAutoScanning,
    autoScanInterval
  } = useStore();
  
  const symbolRef = useRef(symbol);
  const alertRulesRef = useRef(alertRules);

  const getInitialTab = (): 'chain' | 'scanner' | 'alerts' | 'backtest' | 'builder' | 'cone' | 'portfolios' | 'help' | 'rsi_scanner' | 'admin' => {
    const path = window.location.pathname;
    if (path.startsWith('/s/')) {
      return 'builder';
    }
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['chain', 'scanner', 'alerts', 'backtest', 'builder', 'cone', 'portfolios', 'help', 'rsi_scanner', 'admin'];
    return validTabs.includes(hash) ? (hash as any) : 'chain';
  };

  const [activeTab, setActiveTab] = useState<'chain' | 'scanner' | 'alerts' | 'backtest' | 'builder' | 'cone' | 'portfolios' | 'help' | 'rsi_scanner' | 'admin'>(getInitialTab);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/s/')) {
      const shortCode = path.replace('/s/', '').trim();
      if (shortCode) {
        fetch(`${BACKEND_URL}/api/strategy/share/${shortCode}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.legs) {
              setSymbol(data.symbol);
              if (data.expiry) setSelectedExpiry(data.expiry);
              clearLegs();
              const lotSize = getLotSizeForSymbol(data.symbol);
              data.legs.forEach((l: any) => {
                addLeg({
                  strike: l.strike,
                  optionType: l.optionType,
                  expiry: data.expiry || selectedExpiry,
                  action: l.action,
                  quantity: (l.lots || 1) * lotSize,
                  entryPrice: l.entryPrice || 10.0,
                  currentPrice: l.entryPrice || 10.0,
                  iv: 0.16
                });
              });
              setActiveTab('builder');
            }
          })
          .catch(err => console.error("Error loading shared strategy:", err));
      }
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['chain', 'scanner', 'alerts', 'backtest', 'builder', 'cone', 'portfolios', 'help', 'rsi_scanner', 'admin'];
      if (validTabs.includes(hash)) {
        setActiveTab(hash as any);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (tabId: any) => {
    setActiveTab(tabId);
    window.location.hash = tabId;
  };
  const [backgroundNotification, setBackgroundNotification] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [dhanClientIdInput, setDhanClientIdInput] = useState(user?.dhan_client_id || '');
  const [dhanAccessTokenInput, setDhanAccessTokenInput] = useState(user?.dhan_access_token || '');
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [isTestingDhan, setIsTestingDhan] = useState(false);
  const [dhanTestResult, setDhanTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

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

  // Fetch data and run 5-second continuous market data polling loop
  useEffect(() => {
    if (token && user) {
      fetchMarketData();
      fetchPortfolios();

      const pollInterval = setInterval(() => {
        fetchMarketData();
      }, 5000); // Continuous 5-second market quote refresher

      return () => clearInterval(pollInterval);
    }
  }, [token, user, fetchMarketData]);

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
              const allTypes = [
                "SHORT IRON CONDOR", "LONG IRON CONDOR", "IRON CONDOR", "JADE LIZARD", "TWISTED JADE LIZARD", 
                "1:3:2 CALL RATIO FLY", "1:3:2 PUT RATIO FLY", "IRON BUTTERFLY", "BULL PUT SPREAD", "BEAR CALL SPREAD", 
                "BULL CALL SPREAD", "BEAR PUT SPREAD", "CALL BUTTERFLY", "PUT BUTTERFLY", "CALL CONDOR", "PUT CONDOR", 
                "SHORT STRADDLE", "SHORT STRANGLE", "HEDGED SHORT STRANGLE"
              ];
              allTypes.forEach(t => strategyTypes.add(t));
            } else if (r.strategyType.includes("1:3:2")) {
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
                (rule.strategyType.toUpperCase().includes('1:3:2') && scan.name.toUpperCase().includes('1:3:2')) ||
                (rule.strategyType.toUpperCase().includes('JADE') && scan.name.toUpperCase().includes('LIZARD'));
              
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
                            ['SHORT STRADDLE', 'SHORT STRANGLE', 'LONG STRADDLE', 'LONG STRANGLE', 'JADE LIZARD', 'TWISTED JADE LIZARD'].includes(rule.strategyType.toUpperCase());
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
      {/* Top Navigation Bar */}
      <header className="border-b border-borderClr/60 bg-gray-950/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img 
              src={logoImg} 
              className="w-9 h-9 rounded-lg object-cover bg-gray-900 border border-borderClr/60 shadow-lg shadow-accentBrand/10" 
              alt="OptionChief Logo" 
            />
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-wider leading-none">optionchief.in</h1>
              <span className="text-[10px] text-accentCyan font-bold tracking-widest uppercase">F&O Analytics v2.0</span>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={() => setActiveTab('portfolios')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-borderClr/60 hover:border-gray-500 text-gray-300 hover:text-white font-bold transition-all"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Paper Trading Book</span>
            </button>

            {/* Subscription Tier Pill Button */}
            {user && (
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-extrabold transition-all shadow-sm ${
                  user.role?.toLowerCase() === 'owner' || user.subscription_tier === 'owner'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    : user.is_trial
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25'
                    : user.subscription_tier === 'pro'
                    ? 'bg-accentBrand/15 border-accentBrand/40 text-accentBrand hover:bg-accentBrand/25'
                    : 'bg-redBrand/20 border-redBrand/50 text-red-300 hover:bg-redBrand/30 animate-pulse'
                }`}
                title="View Subscription Plans & Pricing"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {user.role?.toLowerCase() === 'owner' || user.subscription_tier === 'owner'
                    ? '👑 OWNER'
                    : user.is_trial
                    ? `⏳ TRIAL: ${user.days_left ?? 15}d LEFT`
                    : user.subscription_tier === 'pro'
                    ? `⭐ PRO (${user.days_left ?? 30}d)`
                    : '🔒 UPGRADE TO PRO'}
                </span>
              </button>
            )}

            <button
              onClick={() => {
                setDhanClientIdInput(user.dhan_client_id || '');
                setDhanAccessTokenInput(user.dhan_access_token || '');
                setShowProfileModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-bold transition-all"
            >
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Profile & Keys</span>
            </button>
            
            <div className="flex items-center gap-3 border-l border-borderClr/60 pl-4">
              <div className="flex flex-col items-end">
                <span className="text-[11px] text-white font-semibold flex items-center gap-1.5" title={user.email || user.display_name || user.phone_number}>
                  <User className="w-3 h-3 text-emerald-400" />
                  {user.email || user.display_name || (user.phone_number?.startsWith('fb_') ? 'Account' : user.phone_number)}
                </span>
                <span className={`text-[9px] uppercase tracking-wider font-extrabold ${
                  user.role?.toLowerCase() === 'owner' || user.subscription_tier === 'owner' ? 'text-greenBrand' : 'text-accentCyan'
                }`}>
                  {user.role?.toLowerCase() === 'owner' ? 'Owner Account' : (user.plan_name || `${user.role} Account`)}
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
        {/* Profile & Broker Settings Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center space-x-2">
                  <Key className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-bold text-white">Profile & Broker Settings</h3>
                </div>
                <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {user.email ? 'Account Email / ID' : 'Account Phone / ID'}
                  </label>
                  <input 
                    type="text" 
                    value={user.display_name ? `${user.display_name} (${user.email || user.phone_number})` : (user.email || user.phone_number)} 
                    disabled 
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-400 cursor-not-allowed" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Platform Role</label>
                  <span className="inline-block px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                    {user.role} Account
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">Dhan Client ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 1000392812"
                    value={dhanClientIdInput}
                    onChange={(e) => setDhanClientIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">Dhan Access Token (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Paste your daily Dhan Access Token here for live orders"
                    value={dhanAccessTokenInput}
                    onChange={(e) => setDhanAccessTokenInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                                {dhanTestResult && (
                  <div className={`border px-3 py-2 rounded text-xs font-semibold ${
                    dhanTestResult.status === 'success' 
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                      : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                  }`}>
                    {dhanTestResult.message}
                  </div>
                )}

                {profileSaveSuccess && (
                  <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-3 py-2 rounded text-xs font-semibold">
                    Profile settings saved successfully! Option chain matrix refreshing...
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    disabled={isTestingDhan}
                    onClick={async () => {
                      setIsTestingDhan(true);
                      setDhanTestResult(null);
                      try {
                        const resp = await fetch(`${BACKEND_URL}/api/auth/test-dhan`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            dhan_client_id: dhanClientIdInput,
                            dhan_access_token: dhanAccessTokenInput
                          })
                        });
                        const data = await resp.json();
                        if (resp.ok) {
                          setDhanTestResult({ status: 'success', message: data.message });
                        } else {
                          setDhanTestResult({ status: 'error', message: `🔴 ${data.detail || 'Connection failed'}` });
                        }
                      } catch (err: any) {
                        setDhanTestResult({ status: 'error', message: `🔴 Connection error: ${err.message}` });
                      } finally {
                        setIsTestingDhan(false);
                      }
                    }}
                    className="px-3 py-2 bg-blue-950 border border-blue-700/60 hover:bg-blue-900 text-blue-300 text-xs rounded font-bold transition-all flex items-center gap-1"
                  >
                    {isTestingDhan ? "Testing..." : "Test Connection"}
                  </button>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowProfileModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await updateUserProfile(dhanClientIdInput, dhanAccessTokenInput);
                        if (ok) {
                          setProfileSaveSuccess(true);
                          setTimeout(() => {
                            setProfileSaveSuccess(false);
                            setShowProfileModal(false);
                          }, 1500);
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded font-bold shadow-lg"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating Notifications Toast */}
        {backgroundNotification && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-amber-500 text-black px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2.5 font-extrabold border border-amber-400 animate-bounce">
            <Bell className="w-5 h-5 animate-pulse" />
            <span>{backgroundNotification}</span>
          </div>
        )}

        {/* Error Notification banner if any */}
        {error && (
          <div className="bg-redBrand/10 border border-redBrand/30 text-redBrand rounded-xl p-3 flex items-center justify-between text-xs transition-all shadow-sm">
            <div className="flex items-center gap-2 pr-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Connection Alert:</strong> {error}. <span className="opacity-80">(Cloud backend may take ~30-60s to wake up on first visit)</span>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => fetchMarketData()}
                className="px-2.5 py-1 bg-redBrand/20 hover:bg-redBrand/30 text-redBrand rounded-lg flex items-center gap-1.5 transition-colors font-medium text-xs"
                title="Retry connecting to backend"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
              <button
                onClick={() => clearError()}
                className="p-1 hover:bg-redBrand/20 rounded-lg transition-colors text-redBrand"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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
              { id: 'rsi_scanner', label: 'RSI Scanner', icon: Zap },
              { id: 'alerts', label: 'Strategy Alerts', icon: Bell },
              { id: 'backtest', label: 'Backtester', icon: History },
              { id: 'builder', label: 'Strategy Analyzer', icon: TrendingUp },
              { id: 'cone', label: 'Volatility Cone', icon: BarChart2 },
              { id: 'portfolios', label: 'Paper Trading Book', icon: Briefcase },
              ...(user?.role?.toLowerCase() === 'owner' ? [{ id: 'admin', label: 'Admin Dashboard', icon: Shield }] : []),
              { id: 'help', label: 'Help & Videos', icon: HelpCircle }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <div key={tab.id} className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleTabChange(tab.id as any)}
                    className={`flex items-center gap-2 px-3 py-3 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
                      isActive
                        ? "border-accentBrand text-white"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                  <a
                    href={`#${tab.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-600 hover:text-accentCyan transition-colors rounded hover:bg-gray-800/60"
                    title={`Open ${tab.label} in a new browser tab`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex flex-col gap-6 min-h-[400px]">
          <div style={{ display: activeTab === 'chain' ? 'block' : 'none' }}>
            <div className="flex flex-col gap-6">
              <ExpirySelector />
              <OptionChainTable />
            </div>
          </div>

          <div style={{ display: activeTab === 'scanner' ? 'block' : 'none' }}>
            <ScannerPanel />
          </div>

          <div style={{ display: activeTab === 'alerts' ? 'block' : 'none' }}>
            <AlertsPanel />
          </div>

          <div style={{ display: activeTab === 'backtest' ? 'block' : 'none' }}>
            <BacktesterPanel />
          </div>

          <div style={{ display: activeTab === 'builder' ? 'block' : 'none' }}>
            <div className="flex flex-col gap-6">
              <LegManager />
              <HedgingAdvisor />
              <PayoffChart />
            </div>
          </div>

          <div style={{ display: activeTab === 'cone' ? 'block' : 'none' }}>
            <VolatilityCone />
          </div>

          <div style={{ display: activeTab === 'portfolios' ? 'block' : 'none' }}>
            <PortfolioManager />
          </div>

          <div style={{ display: activeTab === 'rsi_scanner' ? 'block' : 'none' }}>
            <RsiScannerPanel />
          </div>

          <div style={{ display: activeTab === 'admin' ? 'block' : 'none' }}>
            <AdminPanel />
          </div>

          <div style={{ display: activeTab === 'help' ? 'block' : 'none' }}>
            <HelpPanel />
          </div>
        </div>

        {/* Subscription Plans & Pricing Modal */}
        <SubscriptionModal 
          isOpen={showSubscriptionModal} 
          onClose={() => setShowSubscriptionModal(false)} 
        />
      </main>
    </div>
  );
};

export default App;
