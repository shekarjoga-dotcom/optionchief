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
    bs_pricing
)

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
}

STRIKE_ROUND_INTERVALS = {
    "NIFTY": 50,
    "BANKNIFTY": 100,
    "SENSEX": 100,
    "FINNIFTY": 50,
    "MIDCPNIFTY": 25,
}

VIX_TICKERS = {
    "NIFTY": "^INDIAVIX",
    "BANKNIFTY": "^INDIAVIX",
    "FINNIFTY": "^INDIAVIX",
    "SENSEX": "^INDIAVIX",
}

DEFAULT_PRESETS = [
    {
        "id": "ema_crossover",
        "name": "⚡ 9/21 EMA Crossover + RSI Momentum",
        "description": "Trend scalper that enters on EMA 9/21 cross with RSI directional confirmation.",
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
        "name": "🌊 VWAP Intraday Breakout + Volume",
        "description": "Breakout scalper detecting aggressive institutional volume across daily VWAP.",
        "timeframe": "5m",
        "moneyness": "ATM",
        "tp_pct": 25.0,
        "sl_pct": 12.0,
        "code": """// === VWAP INTRADAY BREAKOUT ===
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
    }
]

# ==========================================
# REQUEST / RESPONSE MODELS
# ==========================================

class ValidateCodeRequest(BaseModel):
    code: str
    symbol: Optional[str] = "BANKNIFTY"
    timeframe: Optional[str] = "5m"

class ScanRequest(BaseModel):
    code: str
    symbols: Optional[List[str]] = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX"]
    timeframe: Optional[str] = "5m"
    moneyness: Optional[str] = "ATM"

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

class OptimizeCustomRequest(BaseModel):
    symbol: str = "BANKNIFTY"
    code: str
    startDate: str
    endDate: str
    timeframe: Optional[str] = "5m"
    tpRange: Optional[List[float]] = [15.0, 25.0, 35.0]
    slRange: Optional[List[float]] = [10.0, 15.0, 20.0]
    moneynessRange: Optional[List[str]] = ["ATM", "OTM1"]
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


# ==========================================
# API ENDPOINTS
# ==========================================

@router.get("/presets")
def get_strategy_presets():
    """Returns curated ready-to-run Chartink-style strategy presets."""
    return DEFAULT_PRESETS


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
    symbol_upper = req.symbol.upper()
    interval_int = int(req.timeframe.replace("m", "").replace("min", "")) if "m" in req.timeframe else 5
    
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
        try:
            test_signals = generate_custom_signals(df, parsed["buy_ce_expr"], parsed["buy_pe_expr"])
            recent_triggers = len(test_signals)
        except Exception as e:
            return {
                "valid": False,
                "error": f"Evaluation Error during test run: {str(e)}",
                "indicators": parsed.get("indicators", []),
                "recentTriggers": 0
            }

    return {
        "valid": True,
        "error": None,
        "indicators": parsed.get("indicators", []),
        "buyCeExpr": parsed.get("buy_ce_expr", ""),
        "buyPeExpr": parsed.get("buy_pe_expr", ""),
        "customParams": parsed.get("custom_params", {}),
        "recentTriggers": recent_triggers,
        "sampleSignals": test_signals[-5:]
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

            # Determine strike based on moneyness
            m_upper = (req.moneyness or "ATM").upper()

            for sig in matching_signals:
                is_ce = sig["direction"] == "BULLISH_CE"
                leg_type = "C" if is_ce else "P"
                
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

    return results


@router.post("/optimize")
def optimize_custom_strategy(req: OptimizeCustomRequest):
    """
    Sweeps TP, SL, and Moneyness parameter spaces for the user's custom strategy.
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

    combinations = list(itertools.product(tp_range, sl_range, moneyness_range))
    results = []

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
