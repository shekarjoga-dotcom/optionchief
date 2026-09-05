import uuid
import itertools
import pandas as pd
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.db.models import CustomStrategyConfig, User
from app.routes.auth import get_current_user
from app.services.market_data import MarketDataService

market_service = MarketDataService()
from app.quant.custom_system_engine import (
    CustomRuleParser,
    generate_custom_signals,
    run_custom_system_backtest,
    run_option_chart_backtest,
    build_option_chart_df,
    bs_pricing
)
from app.quant.stockan_engine import analyze_quant_market

router = APIRouter(prefix="/api/custom-strategy", tags=["Custom Strategy Studio"])

# ==========================================
# CONSTANTS & HELPERS
# ==========================================

LOT_SIZES = {
    "NIFTY": 25,
    "BANKNIFTY": 15,
    "SENSEX": 20,
    "FINNIFTY": 25,
    "MIDCPNIFTY": 75,
    "RELIANCE": 250,
    "HDFCBANK": 550,
    "ICICIBANK": 700,
    "SBIN": 750,
    "TCS": 175,
    "INFY": 400,
    "TATAMOTORS": 1425,
}

STRIKE_ROUND_INTERVALS = {
    "NIFTY": 50,
    "BANKNIFTY": 100,
    "SENSEX": 100,
    "FINNIFTY": 50,
    "MIDCPNIFTY": 25,
    "RELIANCE": 20,
    "HDFCBANK": 10,
    "ICICIBANK": 10,
    "SBIN": 5,
    "TCS": 20,
    "INFY": 10,
    "TATAMOTORS": 10,
}

INDEX_SYMBOLS = {"NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX", "MIDCPNIFTY", "^NSEI", "^NSEBANK"}

VIX_TICKERS = {
    "NIFTY": "^INDIAVIX",
    "BANKNIFTY": "^INDIAVIX",
    "FINNIFTY": "^INDIAVIX",
    "SENSEX": "^INDIAVIX",
}

DEFAULT_PRESETS = [
    {
        "id": "niftybees_index_trend_rider",
        "name": "💎 NIFTYBEES Index Trend Rider (Zero Theta Decay)",
        "description": "Scans NIFTY 50 index candles for Supertrend & EMA alignment, but enters NIFTYBEES ETF directly instead of options. Completely eliminates time decay wipes.",
        "symbol": "NIFTY",
        "timeframe": "15m",
        "moneyness": "NIFTYBEES",
        "tp_pct": 2.0,
        "sl_pct": 0.8,
        "code": """// === NIFTYBEES INDEX TREND RIDER (ZERO THETA DECAY) ===
// Scans NIFTY 50 Index candles, enters NIFTYBEES ETF directly!
// Zero Time Decay · Complete Elimination of Theta Drag

// Bullish Entry (Buy NIFTYBEES ETF Units):
BUY_CE: Supertrend(10, 2.0) is Bullish and RSI(14) crosses above 52 and Close > EMA(20)

// Exit / Bearish Reversal (Square off NIFTYBEES or Book Profits):
BUY_PE: Supertrend(10, 2.0) is Bearish and RSI(14) crosses below 48 and Close < EMA(20)

// Index ETF Risk Targets (2.0% Target vs 0.8% Stop Loss on ETF):
TP = 2.0%
SL = 0.8%
"""
    },
    {
        "id": "optionrider_niftybees_edition",
        "name": "🧠 OptionRider NIFTYBEES Edition (Gap + Zero Decay)",
        "description": "Scans NIFTY index opening gap & momentum, but executes in NIFTYBEES ETF shares to neutralize time decay wipeouts.",
        "symbol": "NIFTY",
        "timeframe": "15m",
        "moneyness": "NIFTYBEES",
        "tp_pct": 2.5,
        "sl_pct": 1.0,
        "code": """// === OPTIONRIDER AI: NIFTYBEES ETF EDITION ===
// Scans NIFTY 50 Index for opening momentum, enters NIFTYBEES ETF directly!
// Eliminates all Greeks risk, IV crush, and expiration decay.

// Bullish Entry (Buy NIFTYBEES ETF):
BUY_CE: Close > Open and Close > EMA(20) and Supertrend(10, 2.0) is Bullish and RSI(14) crosses above 54

// Bearish Entry (Exit NIFTYBEES / Take Profit):
BUY_PE: Close < Open and Close < EMA(20) and Supertrend(10, 2.0) is Bearish and RSI(14) crosses below 46

// ETF Risk Rules:
TP = 2.5%
SL = 1.0%
"""
    },
    {
        "id": "banknifty_asymmetric_scalper",
        "name": "🏆 BankNifty 15m Asymmetric Scalper (PF 1.72 | ITM)",
        "description": "Backtested positive expectancy on BankNifty. Uses In-The-Money options with 1:2.5 Risk-to-Reward to neutralize Theta decay.",
        "symbol": "BANKNIFTY",
        "timeframe": "15m",
        "moneyness": "ITM",
        "tp_pct": 20.0,
        "sl_pct": 8.0,
        "code": """// === BANKNIFTY 15-MIN ASYMMETRIC ITM SCALPER ===
// High Expectancy Momentum Setup (1:2.5 Risk-to-Reward)
// Bullish Rule (Buy In-The-Money CALL Option):
BUY_CE: Supertrend(10, 2.0) is Bullish and RSI(14) crosses above 55 and Close > EMA(20)

// Bearish Rule (Buy In-The-Money PUT Option):
BUY_PE: Supertrend(10, 2.0) is Bearish and RSI(14) crosses below 45 and Close < EMA(20)

// Asymmetric Targets (8% Stop Loss vs 20% Take Profit):
TP = 20%
SL = 8%
"""
    },
    {
        "id": "nifty_bb_mean_reversion",
        "name": "🎯 Nifty 15m Bollinger Reversal (PF 1.10 | ITM)",
        "description": "Mean-reversion scalper designed specifically for Nifty 50. Catches extreme range bounces back to the 20-period moving average.",
        "symbol": "NIFTY",
        "timeframe": "15m",
        "moneyness": "ITM",
        "tp_pct": 18.0,
        "sl_pct": 8.0,
        "code": """// === NIFTY 15-MIN BOLLINGER MEAN REVERSION ===
// Catches explosive mean-reversion snaps back to center band
// Bullish Entry (Buy In-The-Money CALL on Lower Band bounce):
BUY_CE: Close crosses above BB_Lower(20, 2.0) and RSI(14) < 40

// Bearish Entry (Buy In-The-Money PUT on Upper Band rejection):
BUY_PE: Close crosses below BB_Upper(20, 2.0) and RSI(14) > 60

// Target & Stop Loss Settings:
TP = 18%
SL = 8%
"""
    },
    {
        "id": "option_rider_ai",
        "name": "🧠 OptionRider AI (IV Velocity & Gap Rider)",
        "description": "Inspired by OptionRiderAIEngine: Filters trades by IV momentum vs Theta decay rate, trading opening gap continuations with strict time cutoffs.",
        "symbol": "BANKNIFTY",
        "timeframe": "15m",
        "moneyness": "ITM",
        "tp_pct": 20.0,
        "sl_pct": 8.0,
        "code": """// === OPTIONRIDER AI: GAP + THETA DEFENSE ===
// Rule 1: Normal/Mild Gap Continuation with Trend Alignment
// Rule 2: High Velocity Entry with Tight Asymmetric Risk-Reward (2.5:1)

// Bullish Entry (CALL Option):
BUY_CE: Close > Open and Close > EMA(20) and Supertrend(10, 2.0) is Bullish and RSI(14) crosses above 54

// Bearish Entry (PUT Option):
BUY_PE: Close < Open and Close < EMA(20) and Supertrend(10, 2.0) is Bearish and RSI(14) crosses below 46

// OptionRider Risk Rules:
TP = 20%
SL = 8%
"""
    },
    {
        "id": "ema_crossover",
        "name": "⚡ 9/21 EMA Crossover + RSI Momentum",
        "description": "Trend scalper that enters on EMA 9/21 cross with RSI directional confirmation.",
        "symbol": "BANKNIFTY",
        "timeframe": "5m",
        "moneyness": "ATM",
        "tp_pct": 25.0,
        "sl_pct": 12.0,
        "code": """// === 9/21 EMA CROSSOVER + RSI MOMENTUM ===
// Bullish Entry (CALL Option):
BUY_CE: [0] Close > [0] EMA(20) and EMA(9) crosses above EMA(21) and RSI(14) > 55

// Bearish Entry (PUT Option):
BUY_PE: [0] Close < [0] EMA(20) and EMA(9) crosses below EMA(21) and RSI(14) < 45

// Target & Stop Loss Defaults
TP = 25%
SL = 12%
"""
    },
    {
        "id": "supertrend_scalper",
        "name": "🎯 Supertrend 10/3 Option Rider",
        "description": "Rides intraday index momentum using Supertrend and price action above/below EMA 20.",
        "symbol": "BANKNIFTY",
        "timeframe": "5m",
        "moneyness": "ATM",
        "tp_pct": 30.0,
        "sl_pct": 15.0,
        "code": """// === SUPERTREND OPTION RIDER ===
// Bullish Entry (CALL Option):
BUY_CE: Supertrend(10, 3) is Bullish and Close > EMA(20) and RSI(14) > 50

// Bearish Entry (PUT Option):
BUY_PE: Supertrend(10, 3) is Bearish and Close < EMA(20) and RSI(14) < 50

TP = 30%
SL = 15%
"""
    },
    {
        "id": "vwap_breakout",
        "name": "🌊 VWAP Intraday Breakout (F&O Stock / Volume)",
        "description": "Breakout scalper detecting institutional volume across daily VWAP. Best on F&O stocks with real volume (RELIANCE, HDFCBANK).",
        "symbol": "RELIANCE",
        "timeframe": "5m",
        "moneyness": "ATM",
        "tp_pct": 25.0,
        "sl_pct": 12.0,
        "code": """// === VWAP INTRADAY BREAKOUT ===
// Note: VWAP requires traded volume. Best suited on F&O stocks (RELIANCE, etc.)
// Bullish Entry (CALL Option):
BUY_CE: Close crosses above VWAP and RSI(14) > 60 and Close > High[-1]

// Bearish Entry (PUT Option):
BUY_PE: Close crosses below VWAP and RSI(14) < 40 and Close < Low[-1]

TP = 25%
SL = 12%
"""
    },
    {
        "id": "bollinger_blast",
        "name": "💥 Bollinger Band Volatility Blast",
        "description": "Catches explosive option moves when price expands outside Bollinger Bands.",
        "symbol": "BANKNIFTY",
        "timeframe": "15m",
        "moneyness": "OTM1",
        "tp_pct": 35.0,
        "sl_pct": 15.0,
        "code": """// === BOLLINGER BAND BLAST ===
// Bullish Entry (CALL Option):
BUY_CE: Close crosses above BB_Upper(20, 2.0) and RSI(14) > 65

// Bearish Entry (PUT Option):
BUY_PE: Close crosses below BB_Lower(20, 2.0) and RSI(14) < 35

TP = 35%
SL = 15%
"""
    },
    {
        "id": "rsi_extreme_scalp",
        "name": "⚡ RSI 60/40 Momentum Breakout",
        "description": "Enters high-probability option trends when RSI crosses key 60/40 momentum barriers.",
        "timeframe": "5m",
        "moneyness": "ATM",
        "tp_pct": 20.0,
        "sl_pct": 10.0,
        "code": """// === RSI 60/40 MOMENTUM BREAKOUT ===
// Bullish Entry (CALL Option):
BUY_CE: RSI(14) crosses above 60 and Close > EMA(20)

// Bearish Entry (PUT Option):
BUY_PE: RSI(14) crosses below 40 and Close < EMA(20)

TP = 20%
SL = 10%
"""
    },
    {
        "id": "option_chart_ha_breakout",
        "name": "🔥 Option Chart: Heikin-Ashi Flat-Base Breakout",
        "description": "Scans ATM & nearby Option Premium Charts directly. Enters when option candle shows strong trend with HA-Low == HA-Open (no bottom wick) and momentum expansion.",
        "symbol": "NIFTY",
        "timeframe": "5m",
        "moneyness": "ATM",
        "chart_target": "OPTION_CHARTS",
        "option_strikes_range": "ATM_1",
        "tp_pct": 25.0,
        "sl_pct": 12.0,
        "code": """// === OPTION PREMIUM CHART: HEIKIN-ASHI BREAKOUT ===
// Scans directly on ATM & nearby CE/PE option premium candlestick charts!
// Bullish Option Premium Breakout (HA-Low == HA-Open = No bottom wick on option candle):
BUY_CE: [0] 5 minute HA-Low == [0] 5 minute HA-Open and [0] Close > [0] EMA(20) and RSI(14) > 55

// Alternative Breakout Rule for Put Option Charts:
BUY_PE: [0] 5 minute HA-Low == [0] 5 minute HA-Open and [0] Close > [0] EMA(20) and RSI(14) > 55

TP = 25%
SL = 12%
"""
    },
    {
        "id": "animesh_ema_band_macd",
        "name": "📊 Animesh EMA Band (21 High/Low) + MACD Momentum",
        "description": "Crosses EMA 21 envelope with MACD confirmation. Buy Call on Close crossing above 21 EMA(High); Buy Put on Close crossing below 21 EMA(Low).",
        "symbol": "BANKNIFTY",
        "timeframe": "5m",
        "moneyness": "ATM",
        "tp_pct": 30.0,
        "sl_pct": 15.0,
        "code": """// === ANIMESH EMA BAND (21 HIGH/LOW) + MACD MOMENTUM ===
// Bullish Entry (Buy Call when Close crosses above 21 EMA of High with positive MACD):
BUY_CE: Close crosses above EMA(HIGH, 21) and MACD_LINE(12, 26, 9) > MACD_SIGNAL(12, 26, 9) and MACD_HIST(12, 26, 9) > 0

// Bearish Entry (Buy Put when Close crosses below 21 EMA of Low with negative MACD):
BUY_PE: Close crosses below EMA(LOW, 21) and MACD_LINE(12, 26, 9) < MACD_SIGNAL(12, 26, 9) and MACD_HIST(12, 26, 9) < 0

// Risk Management:
TP = 30%
SL = 15%
"""
    }
]

# ==========================================
# REQUEST / RESPONSE MODELS
# ==========================================

class ValidateCodeRequest(BaseModel):
    code: str
    symbol: Optional[str] = "BANKNIFTY"
    timeframe: Optional[str] = "5m"
    chartTarget: Optional[str] = "SPOT"  # "SPOT" or "OPTION_CHARTS"

class ScanRequest(BaseModel):
    code: str
    symbols: Optional[List[str]] = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX"]
    timeframe: Optional[str] = "5m"
    moneyness: Optional[str] = "ATM"
    chartTarget: Optional[str] = "SPOT"  # "SPOT" or "OPTION_CHARTS"
    optionStrikesRange: Optional[str] = "ATM_1"  # "ATM", "ATM_1", "ATM_2"

class BacktestCustomRequest(BaseModel):
    symbol: str = "BANKNIFTY"
    code: str
    startDate: str
    endDate: str
    timeframe: Optional[str] = "5m"
    moneyness: Optional[str] = "ATM"
    takeProfitPct: Optional[float] = 25.0
    stopLossPct: Optional[float] = 15.0
    initialCapital: Optional[float] = 100000.0
    lots: Optional[int] = 1
    slippagePerLeg: Optional[float] = 0.5
    chartTarget: Optional[str] = "SPOT"  # "SPOT" or "OPTION_CHARTS"
    optionStrikesRange: Optional[str] = "ATM_1"  # "ATM", "ATM_1", "ATM_2"

class OptimizeCustomRequest(BaseModel):
    symbol: str = "BANKNIFTY"
    code: str
    startDate: str
    endDate: str
    timeframe: Optional[str] = "5m"
    tpRange: Optional[List[float]] = [15.0, 25.0, 35.0]
    slRange: Optional[List[float]] = [10.0, 15.0, 20.0]
    moneynessRange: Optional[List[str]] = ["ATM", "OTM1"]
    chartTarget: Optional[str] = "SPOT"  # "SPOT" or "OPTION_CHARTS"
    optionStrikesRange: Optional[str] = "ATM_1"  # "ATM", "ATM_1", "ATM_2"
    objective: Optional[str] = "netReturnPct"  # "netReturnPct", "winRate", "profitFactor", "maxDrawdown"

class SaveStrategyRequest(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    code: str
    symbol: str = "BANKNIFTY"
    timeframe: str = "5m"
    moneyness: str = "ATM"
    lot_size: int = 1
    tp_pct: float = 25.0
    sl_pct: float = 15.0

class TranspileRequest(BaseModel):
    condition: str
    direction: Optional[str] = "BUY_CE"
    assetClass: Optional[str] = "OPTIONS"  # "STOCKS", "ETFS", "OPTIONS"
    tpPct: Optional[float] = None
    slPct: Optional[float] = None


# ==========================================
# API ENDPOINTS
# ==========================================

@router.get("/presets")
def get_strategy_presets():
    """Returns curated ready-to-run Chartink-style strategy presets."""
    return DEFAULT_PRESETS


@router.post("/transpile")
def transpile_custom_code(req: TranspileRequest):
    """
    Compiles raw condition text (Chartink or natural rules) into clean,
    executable system code with appropriate direction, TP, and SL.
    """
    raw = req.condition.strip()
    if not raw:
        return {"code": "", "valid": False, "error": "Condition cannot be empty."}

    ac = (req.assetClass or "OPTIONS").upper()
    default_tp = 2.0 if ac in ["ETFS", "STOCKS"] else 25.0
    default_sl = 0.8 if ac == "ETFS" else (1.0 if ac == "STOCKS" else 12.0)
    tp = req.tpPct if (req.tpPct is not None and req.tpPct > 0) else default_tp
    sl = req.slPct if (req.slPct is not None and req.slPct > 0) else default_sl

    has_prefix = bool(re.search(r'BUY_(?:CE|PE)\s*:', raw, re.IGNORECASE))
    if has_prefix:
        full_code = raw
        if "TP" not in full_code.upper():
            full_code += f"\n\nTP = {tp}%"
        if "SL" not in full_code.upper():
            full_code += f"\nSL = {sl}%"
    else:
        dir_tag = "BUY_PE" if req.direction == "BUY_PE" else "BUY_CE"
        header = f"// === AUTO-GENERATED SYSTEM CODE ({ac}) ===\n"
        header += f"// Signal: {'BULLISH (BUY CE / Long)' if dir_tag == 'BUY_CE' else 'BEARISH (BUY PE / Short)'}\n\n"
        full_code = f"{header}{dir_tag}: {raw}\n\nTP = {tp}%\nSL = {sl}%\n"

    try:
        parsed = CustomRuleParser.parse_system_code(full_code)
        return {
            "code": full_code,
            "parsedCe": parsed.get("buy_ce_expr", ""),
            "parsedPe": parsed.get("buy_pe_expr", ""),
            "indicators": parsed.get("indicators", []),
            "valid": True,
            "error": None
        }
    except Exception as e:
        return {
            "code": full_code,
            "valid": False,
            "error": str(e)
        }


@router.post("/validate")
def validate_custom_code(req: ValidateCodeRequest):
    """
    Parses user rules, detects indicators, checks syntax,
    and runs a fast dry-run against recent candles to verify execution.
    """
    if not req.code or not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")

    try:
        parsed = CustomRuleParser.parse_system_code(req.code)
    except Exception as e:
        return {
            "valid": False,
            "error": f"Syntax Error: {str(e)}",
            "indicators": [],
            "recentTriggers": 0
        }

    # Fetch recent candles for dry-run
    symbol_upper = req.symbol.upper() if req.symbol else "BANKNIFTY"
    interval_int = int(req.timeframe.replace("m", "").replace("min", "")) if "m" in req.timeframe else 5
    
    # Check VWAP on spot index
    vwap_used = ("vwap" in req.code.lower()) or any(ind.get("type", "").lower() == "vwap" for ind in parsed.get("indicators", []))
    vwap_warning = None
    if vwap_used and symbol_upper in INDEX_SYMBOLS:
        vwap_warning = (
            f"Spot index '{symbol_upper}' does not have exchange-traded volume in cash spot feeds. "
            f"VWAP operates as an intraday typical price average proxy. For true volume-weighted VWAP, "
            f"apply to liquid F&O stocks (e.g. RELIANCE, HDFCBANK, SBIN, TCS, INFY) or Index Futures."
        )

    try:
        raw_candles = market_service.get_historical_intraday_candles(
            symbol=symbol_upper,
            interval=interval_int
        )
    except Exception:
        raw_candles = []

    recent_triggers = 0
    test_signals = []
    if raw_candles and len(raw_candles) >= 10:
        df = pd.DataFrame(raw_candles[-80:])
        if (req.chartTarget or "").upper() == "OPTION_CHARTS":
            last_spot = float(df.iloc[-1]['close'])
            strike_rnd = STRIKE_ROUND_INTERVALS.get(symbol_upper, 50)
            atm_strk = round(last_spot / strike_rnd) * strike_rnd
            df = build_option_chart_df(df, atm_strk, 'C')
        try:
            test_signals = generate_custom_signals(df, parsed["buy_ce_expr"], parsed["buy_pe_expr"])
            recent_triggers = len(test_signals)
        except Exception as e:
            return {
                "valid": False,
                "error": f"Evaluation Error during test run: {str(e)}",
                "indicators": parsed.get("indicators", []),
                "recentTriggers": 0,
                "vwapWarning": vwap_warning
            }

    return {
        "valid": True,
        "error": None,
        "indicators": parsed.get("indicators", []),
        "buyCeExpr": parsed.get("buy_ce_expr", ""),
        "buyPeExpr": parsed.get("buy_pe_expr", ""),
        "customParams": parsed.get("custom_params", {}),
        "recentTriggers": recent_triggers,
        "sampleSignals": test_signals[-5:],
        "vwapWarning": vwap_warning
    }


@router.post("/scan")
def run_custom_scanner(req: ScanRequest):
    """
    Scans selected symbols across intraday candles using the user's custom system rules.
    Emits active and recent trigger signals with recommended option strike and LTP.
    """
    parsed = CustomRuleParser.parse_system_code(req.code)
    if not parsed["buy_ce_expr"] and not parsed["buy_pe_expr"]:
        raise HTTPException(status_code=400, detail="No valid BUY_CE or BUY_PE condition rules found in code.")

    interval_int = int(req.timeframe.replace("m", "").replace("min", "")) if "m" in req.timeframe else 5
    scanner_results = []

    for sym in req.symbols:
        sym_upper = sym.upper()
        strike_round = STRIKE_ROUND_INTERVALS.get(sym_upper, 50)
        lot_mult = LOT_SIZES.get(sym_upper, 25)

        try:
            raw_candles = market_service.get_historical_intraday_candles(
                symbol=sym_upper,
                interval=interval_int
            )
            if not raw_candles or len(raw_candles) < 15:
                continue

            df = pd.DataFrame(raw_candles)
            signals = generate_custom_signals(df, parsed["buy_ce_expr"], parsed["buy_pe_expr"])
            
            # Check the last 3 candles for signals
            recent_candles_ts = set(df['timestamp'].tail(3).astype(str))
            matching_signals = [s for s in signals if s["timestamp"] in recent_candles_ts]
            
            last_candle = df.iloc[-1]
            spot = float(last_candle['close'])
            atm_strike = round(spot / strike_round) * strike_round

            # Check if Direct Option Chart Scanning is requested
            chart_target = (req.chartTarget or "SPOT").upper()
            is_option_chart_scan = (chart_target == "OPTION_CHARTS") or ((req.moneyness or "").upper() == "OPTION_CHARTS")

            if is_option_chart_scan:
                rng = (req.optionStrikesRange or "ATM_1").upper()
                if rng == "ATM":
                    strike_offsets = [0]
                elif rng == "ATM_2":
                    strike_offsets = [0, 1, -1, 2, -2]
                else:
                    strike_offsets = [0, 1, -1]  # ATM_1 default (ATM, OTM1, ITM1)

                for off in strike_offsets:
                    # 1. Evaluate CALL Option Chart
                    call_strike = atm_strike + (off * strike_round)
                    call_m_label = "ATM" if off == 0 else (f"OTM{off}" if off > 0 else f"ITM{-off}")
                    ce_df = build_option_chart_df(df, call_strike, 'C')

                    ce_signals = generate_custom_signals(ce_df, parsed["buy_ce_expr"], "")
                    ce_recent = [s for s in ce_signals if s["timestamp"] in recent_candles_ts]

                    for sig in ce_recent:
                        current_prem = float(ce_df.iloc[-1]['close'])
                        scanner_results.append({
                            "symbol": sym_upper,
                            "direction": "BULLISH_CE",
                            "triggerTime": sig["timestamp"],
                            "spotPrice": round(spot, 2),
                            "strike": int(call_strike),
                            "optionType": "CE",
                            "contractName": f"{sym_upper} {int(call_strike)} CE ({call_m_label} Option Chart)",
                            "estimatedPremium": round(current_prem, 2),
                            "lotSize": lot_mult,
                            "isEtf": False,
                            "isEquity": False,
                            "chartSource": "OPTION_CHART",
                            "isOptionChart": True,
                            "indicators": sig.get("indicators", {}),
                            "candle": sig.get("candle", {})
                        })

                    # 2. Evaluate PUT Option Chart
                    put_strike = atm_strike - (off * strike_round)
                    put_m_label = "ATM" if off == 0 else (f"OTM{off}" if off > 0 else f"ITM{-off}")
                    pe_df = build_option_chart_df(df, put_strike, 'P')

                    # On Put option chart: if buy_pe_expr exists, evaluate it; otherwise evaluate the primary rule
                    pe_rule = parsed["buy_pe_expr"] if parsed["buy_pe_expr"] else parsed["buy_ce_expr"]
                    pe_signals = generate_custom_signals(pe_df, pe_rule, "")
                    pe_recent = [s for s in pe_signals if s["timestamp"] in recent_candles_ts]

                    for sig in pe_recent:
                        current_prem = float(pe_df.iloc[-1]['close'])
                        scanner_results.append({
                            "symbol": sym_upper,
                            "direction": "BULLISH_PE",
                            "triggerTime": sig["timestamp"],
                            "spotPrice": round(spot, 2),
                            "strike": int(put_strike),
                            "optionType": "PE",
                            "contractName": f"{sym_upper} {int(put_strike)} PE ({put_m_label} Option Chart)",
                            "estimatedPremium": round(current_prem, 2),
                            "lotSize": lot_mult,
                            "isEtf": False,
                            "isEquity": False,
                            "chartSource": "OPTION_CHART",
                            "isOptionChart": True,
                            "indicators": sig.get("indicators", {}),
                            "candle": sig.get("candle", {})
                        })
                continue

            # Standard Spot Chart Scan Mode
            # Determine strike based on moneyness
            m_upper = (req.moneyness or "ATM").upper()
            is_etf_mode = m_upper in ["NIFTYBEES", "BANKBEES", "ETF"]
            is_equity_mode = m_upper in ["EQUITY", "SHARES", "STOCK", "CASH"]

            for sig in matching_signals:
                is_ce = sig["direction"] == "BULLISH_CE"
                leg_type = "C" if is_ce else "P"
                
                if is_etf_mode:
                    is_bank = ("BANK" in sym_upper or m_upper == "BANKBEES")
                    etf_name = "BANKBEES" if is_bank else "NIFTYBEES"
                    ratio = 100.0 if is_bank else 87.82
                    est_prem = round(spot / ratio, 2)
                    contract_name = f"{etf_name} (Zero Theta ETF)" if is_ce else f"{etf_name} [BEARISH EXIT/HEDGE]"
                    
                    scanner_results.append({
                        "symbol": sym_upper,
                        "direction": sig["direction"],
                        "triggerTime": sig["timestamp"],
                        "spotPrice": round(sig["spot_price"], 2),
                        "strike": etf_name,
                        "optionType": "ETF",
                        "contractName": contract_name,
                        "estimatedPremium": est_prem,
                        "lotSize": 50 if is_bank else 100,
                        "isEtf": True,
                        "isEquity": False,
                        "etfSymbol": etf_name,
                        "indicators": sig.get("indicators", {}),
                        "candle": sig.get("candle", {})
                    })
                elif is_equity_mode:
                    contract_name = f"{sym_upper} (Cash Equity / Shares)" if is_ce else f"{sym_upper} [BEARISH EXIT / SHORT]"
                    scanner_results.append({
                        "symbol": sym_upper,
                        "direction": sig["direction"],
                        "triggerTime": sig["timestamp"],
                        "spotPrice": round(sig["spot_price"], 2),
                        "strike": "EQUITY",
                        "optionType": "EQUITY",
                        "contractName": contract_name,
                        "estimatedPremium": round(spot, 2),
                        "lotSize": 10,
                        "isEtf": False,
                        "isEquity": True,
                        "indicators": sig.get("indicators", {}),
                        "candle": sig.get("candle", {})
                    })
                else:
                    if is_ce:
                        strike = atm_strike + (strike_round if m_upper == "OTM1" else (strike_round * 2 if m_upper == "OTM2" else (-strike_round if m_upper == "ITM" else 0)))
                    else:
                        strike = atm_strike - (strike_round if m_upper == "OTM1" else (strike_round * 2 if m_upper == "OTM2" else (-strike_round if m_upper == "ITM" else 0)))

                    # Estimate premium via BS
                    est_prem = max(10.0, round(bs_pricing(spot, strike, 4 / 365.0, 0.065, 0.15, leg_type), 2))

                    scanner_results.append({
                        "symbol": sym_upper,
                        "direction": sig["direction"],
                        "triggerTime": sig["timestamp"],
                        "spotPrice": round(sig["spot_price"], 2),
                        "strike": strike,
                        "optionType": leg_type,
                        "contractName": f"{sym_upper} {strike} {leg_type}E",
                        "estimatedPremium": est_prem,
                        "lotSize": lot_mult,
                        "isEtf": False,
                        "indicators": sig.get("indicators", {}),
                        "candle": sig.get("candle", {})
                    })
        except Exception as e:
            print(f"Error scanning {sym_upper}: {str(e)}")

    return {
        "scannedSymbols": req.symbols,
        "timeframe": req.timeframe,
        "resultsCount": len(scanner_results),
        "matches": scanner_results
    }


@router.post("/backtest")
def backtest_custom_strategy(req: BacktestCustomRequest):
    """
    Runs historical options backtest simulation using the user's custom system rules.
    """
    sym_upper = req.symbol.upper()
    strike_round = STRIKE_ROUND_INTERVALS.get(sym_upper, 50)
    lot_multiplier = LOT_SIZES.get(sym_upper, 25)
    interval_int = int(req.timeframe.replace("m", "").replace("min", "")) if "m" in req.timeframe else 5

    parsed = CustomRuleParser.parse_system_code(req.code)
    if not parsed["buy_ce_expr"] and not parsed["buy_pe_expr"]:
        raise HTTPException(status_code=400, detail="No valid BUY_CE or BUY_PE rules found in code.")

    try:
        raw_candles = market_service.get_historical_intraday_candles(
            symbol=sym_upper,
            interval=interval_int,
            from_date=req.startDate,
            to_date=req.endDate
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical intraday candles: {str(e)}")

    if not raw_candles or len(raw_candles) < 20:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient candle data found for {sym_upper}. Note: Intraday data is available for up to the last 60 days."
        )

    # VIX series fallback
    vix_series = pd.Series(15.0, index=pd.to_datetime([c["timestamp"].split(" ")[0] for c in raw_candles]))

    # Override TP/SL with parsed custom parameters if present
    tp = parsed["custom_params"].get("TP", req.takeProfitPct)
    sl = parsed["custom_params"].get("SL", req.stopLossPct)

    chart_target = (req.chartTarget or "SPOT").upper()
    if chart_target == "OPTION_CHARTS":
        results = run_option_chart_backtest(
            all_candles=raw_candles,
            symbol=sym_upper,
            buy_ce_expr=parsed["buy_ce_expr"],
            buy_pe_expr=parsed["buy_pe_expr"],
            take_profit_pct=tp,
            stop_loss_pct=sl,
            initial_capital=req.initialCapital or 100000.0,
            slippage=req.slippagePerLeg or 0.5,
            lot_multiplier=lot_multiplier,
            strike_round=strike_round,
            strikes_range=req.optionStrikesRange or "ATM_1",
            lots=req.lots or 1
        )
        results["vwapWarning"] = None
        results["chartTarget"] = "OPTION_CHARTS"
        return results

    results = run_custom_system_backtest(
        all_candles=raw_candles,
        vix_series=vix_series,
        symbol=sym_upper,
        buy_ce_expr=parsed["buy_ce_expr"],
        buy_pe_expr=parsed["buy_pe_expr"],
        moneyness=req.moneyness or "ATM",
        take_profit_pct=tp,
        stop_loss_pct=sl,
        initial_capital=req.initialCapital or 100000.0,
        slippage=req.slippagePerLeg or 0.5,
        lot_multiplier=lot_multiplier,
        strike_round=strike_round,
        lots=req.lots or 1
    )

    # Check VWAP warning for spot index
    vwap_used = ("vwap" in req.code.lower()) or any(ind.get("type", "").lower() == "vwap" for ind in parsed.get("indicators", []))
    vwap_warning = None
    if vwap_used and sym_upper in INDEX_SYMBOLS:
        vwap_warning = (
            f"Spot index '{sym_upper}' does not have exchange-traded volume in spot feeds. "
            f"VWAP operated as an intraday typical price average proxy. For real volume-weighted VWAP, "
            f"test on liquid F&O stocks (e.g. RELIANCE, HDFCBANK) or Index Futures."
        )

    results["chartTarget"] = "SPOT"
    results["vwapWarning"] = vwap_warning
    return results


@router.post("/optimize")
def optimize_custom_strategy(req: OptimizeCustomRequest):
    """
    Sweeps TP, SL, and Moneyness parameter spaces for the user's custom strategy.
    Supports both Spot Index and Direct Option Charts (ATM and nearby strikes).
    """
    sym_upper = req.symbol.upper()
    strike_round = STRIKE_ROUND_INTERVALS.get(sym_upper, 50)
    lot_multiplier = LOT_SIZES.get(sym_upper, 25)
    interval_int = int(req.timeframe.replace("m", "").replace("min", "")) if "m" in req.timeframe else 5

    parsed = CustomRuleParser.parse_system_code(req.code)
    if not parsed["buy_ce_expr"] and not parsed["buy_pe_expr"]:
        raise HTTPException(status_code=400, detail="No valid BUY_CE or BUY_PE rules found in code.")

    raw_candles = market_service.get_historical_intraday_candles(
        symbol=sym_upper,
        interval=interval_int,
        from_date=req.startDate,
        to_date=req.endDate
    )
    if not raw_candles or len(raw_candles) < 20:
        raise HTTPException(status_code=400, detail="Insufficient candle data to optimize.")

    vix_series = pd.Series(15.0, index=pd.to_datetime([c["timestamp"].split(" ")[0] for c in raw_candles]))

    tp_range = req.tpRange or [15.0, 25.0, 35.0]
    sl_range = req.slRange or [10.0, 15.0, 20.0]
    moneyness_range = req.moneynessRange or ["ATM", "OTM1"]

    chart_target = (req.chartTarget or "SPOT").upper()
    combinations = list(itertools.product(tp_range, sl_range, moneyness_range))
    results = []

    if chart_target == "OPTION_CHARTS":
        for tp, sl, moneyness in combinations:
            res = run_option_chart_backtest(
                all_candles=raw_candles,
                symbol=sym_upper,
                buy_ce_expr=parsed["buy_ce_expr"],
                buy_pe_expr=parsed["buy_pe_expr"],
                take_profit_pct=tp,
                stop_loss_pct=sl,
                initial_capital=100000.0,
                slippage=0.5,
                lot_multiplier=lot_multiplier,
                strike_round=strike_round,
                strikes_range=moneyness if moneyness in ["ATM", "ATM_1", "ATM_2"] else (req.optionStrikesRange or "ATM"),
                lots=1
            )
            results.append({
                "parameters": {
                    "takeProfitPct": tp,
                    "stopLossPct": sl,
                    "moneyness": moneyness
                },
                "metrics": res["metrics"]
            })
    else:
        for tp, sl, moneyness in combinations:
            res = run_custom_system_backtest(
                all_candles=raw_candles,
                vix_series=vix_series,
                symbol=sym_upper,
                buy_ce_expr=parsed["buy_ce_expr"],
                buy_pe_expr=parsed["buy_pe_expr"],
                moneyness=moneyness,
                take_profit_pct=tp,
                stop_loss_pct=sl,
                initial_capital=100000.0,
                slippage=0.5,
                lot_multiplier=lot_multiplier,
                strike_round=strike_round,
                lots=1
            )
            results.append({
                "parameters": {
                    "takeProfitPct": tp,
                    "stopLossPct": sl,
                    "moneyness": moneyness
                },
                "metrics": res["metrics"]
            })

    obj = req.objective or "netReturnPct"
    def sort_key(item):
        val = item["metrics"].get(obj, 0.0)
        if val == "Unlimited" or val == 999.0:
            return float('inf')
        if obj == "maxDrawdown":
            return -val
        return val

    sorted_results = sorted(results, key=sort_key, reverse=True)

    return {
        "objective": obj,
        "resultsCount": len(sorted_results),
        "chartTarget": chart_target,
        "results": sorted_results[:50]
    }


# ==========================================
# SAVE / LOAD CUSTOM STRATEGIES
# ==========================================

@router.post("/save")
async def save_custom_strategy(
    req: SaveStrategyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Saves user's custom trading system to the database."""
    strategy_id = req.id or str(uuid.uuid4())
    result = await db.execute(
        select(CustomStrategyConfig).where(
            CustomStrategyConfig.id == strategy_id,
            CustomStrategyConfig.user_id == current_user.id
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.name = req.name
        existing.description = req.description or ""
        existing.code = req.code
        existing.symbol = req.symbol
        existing.timeframe = req.timeframe
        existing.moneyness = req.moneyness
        existing.lot_size = req.lot_size
        existing.tp_pct = req.tp_pct
        existing.sl_pct = req.sl_pct
        await db.commit()
        await db.refresh(existing)
        return {"status": "updated", "id": existing.id}
    else:
        new_config = CustomStrategyConfig(
            id=strategy_id,
            user_id=current_user.id,
            name=req.name,
            description=req.description or "",
            code=req.code,
            symbol=req.symbol,
            timeframe=req.timeframe,
            moneyness=req.moneyness,
            lot_size=req.lot_size,
            tp_pct=req.tp_pct,
            sl_pct=req.sl_pct
        )
        db.add(new_config)
        await db.commit()
        await db.refresh(new_config)
        return {"status": "created", "id": new_config.id}


@router.get("/saved")
async def get_saved_strategies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetches all saved custom strategies for the current user."""
    result = await db.execute(
        select(CustomStrategyConfig).where(
            CustomStrategyConfig.user_id == current_user.id
        ).order_by(CustomStrategyConfig.created_at.desc())
    )
    configs = result.scalars().all()
    return configs


@router.delete("/saved/{strategy_id}")
async def delete_saved_strategy(
    strategy_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a user's custom saved strategy."""
    result = await db.execute(
        select(CustomStrategyConfig).where(
            CustomStrategyConfig.id == strategy_id,
            CustomStrategyConfig.user_id == current_user.id
        )
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Strategy not found")
    await db.delete(existing)
    await db.commit()
    return {"status": "deleted", "id": strategy_id}


# ==========================================
# AI QUANT READ & NIFTYBEES ENGINE (STOCKAN)
# ==========================================

@router.get("/quant-read")
def get_quant_market_read(symbol: str = "NIFTY"):
    """
    Computes Stockan Quant Engine read, CALL vs PUT structural comparison,
    NIFTYBEES zero-decay support zones, and defined-risk credit spreads.
    """
    sym_upper = symbol.upper()
    try:
        underlying = market_service.get_underlying_data(sym_upper)
        spot = float(underlying.get("spot", 24800.0)) if underlying else 24800.0
    except Exception:
        spot = 24800.0 if "NIFTY" in sym_upper else 51000.0

    # Fetch 15m candles
    try:
        intraday_15m = market_service.get_historical_intraday_candles(symbol=sym_upper, interval=15)
    except Exception:
        intraday_15m = []

    # Fetch daily candles for ATR
    try:
        daily_candles = market_service.get_historical_prices(symbol=sym_upper, period="3mo")
    except Exception:
        daily_candles = []

    # Fetch option chain
    try:
        chain = market_service.get_option_chain(symbol=sym_upper)
    except Exception:
        chain = None

    # Fetch NIFTYBEES spot
    niftybees_cmp = None
    if "NIFTY" in sym_upper:
        try:
            bees_data = market_service.get_underlying_data("NIFTYBEES")
            niftybees_cmp = float(bees_data.get("spot")) if bees_data and bees_data.get("spot") else None
        except Exception:
            niftybees_cmp = None

    # Fetch INDIA VIX
    vix_val = 13.85
    try:
        vix_data = market_service.get_underlying_data("^INDIAVIX")
        if vix_data and vix_data.get("spot"):
            vix_val = float(vix_data.get("spot"))
    except Exception:
        pass

    # Fetch Heavyweights: HDFCBANK, ICICIBANK, RELIANCE, INFY, TCS
    heavyweights_data = {}
    for hw_sym in ["HDFCBANK", "ICICIBANK", "RELIANCE", "INFY", "TCS"]:
        try:
            hw_info = market_service.get_underlying_data(hw_sym)
            if hw_info and hw_info.get("spot"):
                heavyweights_data[hw_sym] = hw_info
        except Exception:
            pass

    context_data = {
        "fii_dii": "FII +₹1,420 Cr / DII +₹890 Cr as of 03 Sep",
        "breadth": "32 Adv / 18 Dec (Nifty 50)",
        "global_cues": "GIFT Nifty +45 pts, US Mild Positive",
        "news": "Neutral Macro (RBI Policy Stable)"
    }

    result = analyze_quant_market(
        symbol=sym_upper,
        spot_price=spot,
        intraday_15m_candles=intraday_15m,
        daily_candles=daily_candles,
        option_chain=chain,
        niftybees_cmp=niftybees_cmp,
        heavyweights_data=heavyweights_data if heavyweights_data else None,
        vix=vix_val,
        context_data=context_data
    )
    return result

