import { create } from 'zustand';
import type { OptionChainData, StrikeChain, StrategyLeg, SavedPortfolio, Underlying, AlertRule, TriggeredAlert } from '../types';

interface UserProfile {
  phone_number: string;
  role: 'owner' | 'viewer';
}

interface AppState {
  symbol: string;
  underlying: Underlying | null;
  expiryDates: string[];
  selectedExpiry: string;
  options: StrikeChain[];
  pcr: number;
  legs: StrategyLeg[];
  portfolios: SavedPortfolio[];
  isLoading: boolean;
  error: string | null;

  // Authentication state
  token: string | null;
  user: UserProfile | null;
  authError: string | null;
  isAuthLoading: boolean;

  setSymbol: (sym: string) => void;
  setSelectedExpiry: (exp: string) => void;
  fetchMarketData: () => Promise<void>;
  
  // Leg Manager actions
  addLeg: (leg: Omit<StrategyLeg, 'id'>) => void;
  removeLeg: (id: string) => void;
  updateLeg: (id: string, updates: Partial<StrategyLeg>) => void;
  clearLegs: () => void;
  loadLegs: (legs: StrategyLeg[]) => void;

  // Portfolio actions
  fetchPortfolios: () => Promise<void>;
  saveCurrentPortfolio: (name: string, description?: string) => Promise<void>;
  updatePortfolio: (portfolio: SavedPortfolio) => Promise<void>;
  squareOffPortfolio: (id: string, realizedPnL: number) => Promise<void>;
  deletePortfolio: (id: string) => Promise<void>;

  // Authentication actions
  requestOtp: (phone: string) => Promise<boolean>;
  registerUser: (phone: string, otp: string, pass: string) => Promise<boolean>;
  loginUser: (phone: string, password?: string, otp?: string) => Promise<boolean>;
  logout: () => void;
  checkAuthSession: () => Promise<void>;

  // Auto-scanning state
  isAutoScanning: boolean;
  autoScanInterval: number;
  setAutoScanning: (active: boolean, intervalSeconds?: number) => void;

  // Alert rules state
  alertRules: AlertRule[];
  fetchAlertRules: () => Promise<void>;
  saveAlertRule: (rule: AlertRule) => Promise<void>;
  deleteAlertRule: (id: string) => Promise<void>;
  deleteAllAlertRules: () => Promise<void>;
  toggleAlertRule: (id: string) => Promise<void>;

  // Triggered alerts state & actions
  triggeredAlerts: TriggeredAlert[];
  fetchTriggeredAlerts: () => Promise<void>;
  clearTriggeredAlerts: () => Promise<void>;
  deleteTriggeredAlert: (id: string) => Promise<void>;

  // Execution state & actions
  executionConfig: { dhan: any; kotak: any; paper: any } | null;
  fetchExecutionConfig: () => Promise<void>;
}

import { BACKEND_URL } from '../config';

export const useStore = create<AppState>((set, get) => ({
  symbol: "NIFTY",
  underlying: null,
  expiryDates: [],
  selectedExpiry: "",
  options: [],
  pcr: 0.0,
  legs: [],
  portfolios: [],
  isLoading: false,
  error: null,

  alertRules: [],
  triggeredAlerts: [],
  executionConfig: null,

  // Auth initial state
  token: localStorage.getItem("options_oracle_token") || "mock_bypass_token",
  user: { phone_number: "+919999999999", role: "owner" } as any,
  authError: null,
  isAuthLoading: false,

  // Auto-scanning initial state
  isAutoScanning: localStorage.getItem("options_oracle_is_auto_scanning") === "true",
  autoScanInterval: parseInt(localStorage.getItem("options_oracle_auto_scan_interval") || "30"),

  setSymbol: (sym) => {
    set({ symbol: sym.toUpperCase(), selectedExpiry: "", options: [] });
    get().fetchMarketData();
  },

  setSelectedExpiry: (exp) => {
    set({ selectedExpiry: exp });
    get().fetchMarketData();
  },

  fetchMarketData: async () => {
    const { symbol, selectedExpiry } = get();
    set({ isLoading: true, error: null });
    try {
      let url = `${BACKEND_URL}/api/market/option-chain?symbol=${symbol}`;
      if (selectedExpiry) {
        url += `&expiry=${selectedExpiry}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch option chain data");
      }

      const data: OptionChainData = await response.json();
      set({
        underlying: data.underlying,
        expiryDates: data.expiry_dates,
        selectedExpiry: data.selected_expiry,
        options: data.options,
        pcr: data.pcr,
        isLoading: false
      });
    } catch (err: any) {
      set({ error: err.message || "An error occurred", isLoading: false });
    }
  },

  addLeg: (legData) => {
    const newLeg: StrategyLeg = {
      ...legData,
      id: Math.random().toString(36).substring(2, 9)
    };
    set((state) => ({ legs: [...state.legs, newLeg] }));
  },

  removeLeg: (id) => {
    set((state) => ({ legs: state.legs.filter((leg) => leg.id !== id) }));
  },

  updateLeg: (id, updates) => {
    set((state) => ({
      legs: state.legs.map((leg) => (leg.id === id ? { ...leg, ...updates } : leg))
    }));
  },

  clearLegs: () => set({ legs: [] }),
  loadLegs: (legs) => set({ legs }),

  fetchPortfolios: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/portfolio/list`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        set({ portfolios: data });
      }
    } catch (err) {
      console.error("Failed to load portfolios", err);
    }
  },

  saveCurrentPortfolio: async (name, description = "") => {
    const { legs, symbol, portfolios, underlying, token } = get();
    if (legs.length === 0) return;

    const newPortfolio: SavedPortfolio = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      symbol,
      description,
      legs,
      createdAt: new Date().toLocaleString(),
      entrySpot: underlying?.spot || 0.0,
      peakProfit: 0.0,
      maxDrawdown: 0.0,
      takeProfit: 20.0,
      stopLoss: 0.0
    };

    try {
      const response = await fetch(`${BACKEND_URL}/api/portfolio/save`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(newPortfolio)
      });

      if (response.ok) {
        set({ portfolios: [...portfolios, newPortfolio] });
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Save request failed");
      }
    } catch (err: any) {
      console.error("Error saving portfolio", err);
      alert(err.message || "Failed to save portfolio to server.");
    }
  },

  updatePortfolio: async (portfolio) => {
    const { token } = get();
    try {
      const response = await fetch(`${BACKEND_URL}/api/portfolio/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(portfolio)
      });
      if (response.ok) {
        set((state) => ({
          portfolios: state.portfolios.map((p) => p.id === portfolio.id ? portfolio : p)
        }));
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Update request failed");
      }
    } catch (err: any) {
      console.error("Failed to update portfolio", err);
      alert(err.message || "Failed to update portfolio settings.");
    }
  },

  squareOffPortfolio: async (id, realizedPnL) => {
    const { token } = get();
    try {
      const response = await fetch(`${BACKEND_URL}/api/portfolio/square-off/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ realized_pnl: realizedPnL })
      });
      if (response.ok) {
        get().fetchPortfolios();
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Square-off request failed");
      }
    } catch (err: any) {
      console.error("Error squaring off portfolio", err);
      alert(err.message || "Failed to square off position.");
    }
  },

  deletePortfolio: async (id) => {
    const { token } = get();
    try {
      const response = await fetch(`${BACKEND_URL}/api/portfolio/delete/${id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        set((state) => ({
          portfolios: state.portfolios.filter((p) => p.id !== id)
        }));
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Delete request failed");
      }
    } catch (err: any) {
      console.error("Error deleting portfolio", err);
      alert(err.message || "Failed to delete portfolio.");
    }
  },

  // Auth actions
  requestOtp: async (phone) => {
    set({ authError: null });
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to request OTP");
      }
      return true;
    } catch (err: any) {
      set({ authError: err.message });
      return false;
    }
  },

  registerUser: async (phone, otp, pass) => {
    set({ isAuthLoading: true, authError: null });
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, otp_code: otp, password: pass })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Registration failed");
      }
      localStorage.setItem("options_oracle_token", data.token);
      set({ token: data.token, user: data.user, isAuthLoading: false });
      get().fetchAlertRules();
      get().fetchExecutionConfig();
      get().fetchPortfolios();
      return true;
    } catch (err: any) {
      set({ authError: err.message, isAuthLoading: false });
      return false;
    }
  },

  loginUser: async (phone, password, otp) => {
    set({ isAuthLoading: true, authError: null });
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, password, otp_code: otp })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }
      localStorage.setItem("options_oracle_token", data.token);
      set({ token: data.token, user: data.user, isAuthLoading: false });
      
      const localScanning = localStorage.getItem("options_oracle_is_auto_scanning") === "true";
      fetch(`${BACKEND_URL}/api/alerts/toggle-scanner?active=${localScanning}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${data.token}`
        }
      }).catch(err => console.error("Failed to sync scanner state", err));

      get().fetchAlertRules();
      get().fetchExecutionConfig();
      get().fetchPortfolios();
      return true;
    } catch (err: any) {
      set({ authError: err.message, isAuthLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("options_oracle_token");
    set({ token: "mock_bypass_token", user: { phone_number: "+919999999999", role: "owner" } as any, portfolios: [], alertRules: [], executionConfig: null });
  },

  checkAuthSession: async () => {
    const token = localStorage.getItem("options_oracle_token") || "mock_bypass_token";
    set({ token, user: { phone_number: "+919999999999", role: "owner" } as any, isAuthLoading: false });
    
    const localScanning = localStorage.getItem("options_oracle_is_auto_scanning") === "true";
    fetch(`${BACKEND_URL}/api/alerts/toggle-scanner?active=${localScanning}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }).catch(() => {});

    get().fetchAlertRules();
    get().fetchExecutionConfig();
    get().fetchPortfolios();
  },

  setAutoScanning: async (active, intervalSeconds = 30) => {
    localStorage.setItem("options_oracle_is_auto_scanning", active ? "true" : "false");
    localStorage.setItem("options_oracle_auto_scan_interval", String(intervalSeconds));
    set({ isAutoScanning: active, autoScanInterval: intervalSeconds });

    const { token } = get();
    if (!token) return;
    try {
      await fetch(`${BACKEND_URL}/api/alerts/toggle-scanner?active=${active}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error("Failed to toggle backend scanner state", err);
    }
  },

  fetchAlertRules: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/rules`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const rules = data.map((r: any) => ({
          id: r.id,
          strategyType: r.strategy_type,
          symbol: r.symbol,
          expiry: r.expiry,
          minPop: r.min_pop,
          minRR: r.min_rr,
          minLoss: r.min_loss ?? undefined,
          maxLoss: r.max_loss,
          minDelta: r.min_delta ?? undefined,
          maxDelta: r.max_delta ?? undefined,
          minTheta: r.min_theta ?? undefined,
          maxGamma: r.max_gamma ?? undefined,
          active: r.active,
          autoExecute: r.auto_execute,
          takeProfit: r.take_profit ?? 20,
          stopLoss: r.stop_loss ?? 0
        }));
        set({ alertRules: rules });
      }
    } catch (err) {
      console.error("Failed to fetch alert rules", err);
    }
  },

  saveAlertRule: async (rule) => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          id: rule.id,
          strategy_type: rule.strategyType,
          symbol: rule.symbol,
          expiry: rule.expiry,
          min_pop: rule.minPop,
          min_rr: rule.minRR,
          min_loss: rule.minLoss ?? null,
          max_loss: rule.maxLoss,
          min_delta: rule.minDelta ?? null,
          max_delta: rule.maxDelta ?? null,
          min_theta: rule.minTheta ?? null,
          max_gamma: rule.maxGamma ?? null,
          active: rule.active,
          auto_execute: rule.autoExecute ?? false,
          take_profit: rule.takeProfit ?? 20,
          stop_loss: rule.stopLoss ?? 0
        })
      });

      if (response.ok) {
        await get().fetchAlertRules();
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Failed to save alert rule");
      }
    } catch (err: any) {
      console.error("Error saving alert rule", err);
      alert(err.message || "Failed to save alert rule on server.");
    }
  },

  deleteAlertRule: async (id) => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/rules/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        set((state) => ({
          alertRules: state.alertRules.filter((r) => r.id !== id)
        }));
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Failed to delete alert rule");
      }
    } catch (err: any) {
      console.error("Error deleting alert rule", err);
      alert(err.message || "Failed to delete alert rule.");
    }
  },

  deleteAllAlertRules: async () => {
    const { token, alertRules } = get();
    if (!token) return;
    if (alertRules.length === 0) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/rules/all`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        set({ alertRules: [] });
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Failed to delete all alert rules");
      }
    } catch (err: any) {
      console.error("Error deleting all alert rules", err);
      alert(err.message || "Failed to delete all alert rules.");
    }
  },

  toggleAlertRule: async (id) => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/rules/${id}/toggle`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const updated = await response.json();
        set((state) => ({
          alertRules: state.alertRules.map((r) => r.id === id ? {
            ...r,
            active: updated.active
          } : r)
        }));
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Failed to toggle alert rule");
      }
    } catch (err: any) {
      console.error("Error toggling alert rule", err);
      alert(err.message || "Failed to toggle alert rule.");
    }
  },

  fetchTriggeredAlerts: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/triggered`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const alerts = data.map((a: any) => ({
          id: a.id,
          symbol: a.symbol,
          strategyName: a.strategy_name,
          expiry: a.expiry,
          pop: a.pop,
          maxProfit: a.max_profit,
          maxLoss: a.max_loss,
          rrRatio: a.rr_ratio,
          timestamp: a.timestamp,
          currentPnL: a.current_pnl,
          spotPrice: a.spot_price,
          legs: a.legs,
          ruleId: a.rule_id
        }));
        set({ triggeredAlerts: alerts });
      }
    } catch (err) {
      console.error("Failed to fetch triggered alerts", err);
    }
  },

  clearTriggeredAlerts: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/triggered/clear`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        set({ triggeredAlerts: [] });
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Failed to clear triggered alerts");
      }
    } catch (err: any) {
      console.error("Error clearing triggered alerts", err);
      alert(err.message || "Failed to clear triggered alerts.");
    }
  },

  deleteTriggeredAlert: async (id) => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/triggered/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        set((state) => ({
          triggeredAlerts: state.triggeredAlerts.filter((a) => a.id !== id)
        }));
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Failed to delete triggered alert");
      }
    } catch (err: any) {
      console.error("Error deleting triggered alert", err);
      alert(err.message || "Failed to delete triggered alert.");
    }
  },

  fetchExecutionConfig: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/trade/config`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const config = await response.json();
        set({ executionConfig: config });
      }
    } catch (err) {
      console.error("Failed to fetch execution config", err);
    }
  }
}));
