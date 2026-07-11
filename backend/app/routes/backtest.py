from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from app.quant.black_scholes import bs_pricing
import math
from app.services.market_data import MarketDataService

router = APIRouter()
market_service = MarketDataService()


# Map frontend symbol names to Yahoo Finance tickers
SPOT_TICKERS = {
    "NIFTY": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "SENSEX": "^BSESN",
    "FINNIFTY": "NIFTY_FIN_SERVICE.NS",
    "MIDCPNIFTY": "NIFTY_MID_SELECT.NS",
    "RELIANCE": "RELIANCE.NS",
    "SBIN": "SBIN.NS",
    "ITC": "ITC.NS",
    "SPY": "SPY",
    "AAPL": "AAPL",
    "TSLA": "TSLA",
    "CRUDEOIL": "CL=F",
    "CRUDEOILM": "CL=F",
    "SILVER": "SI=F",
    "SILVERM": "SI=F",
    "GOLD": "GC=F",
    "GOLDM": "GC=F",
    "NATURALGAS": "NG=F",
    "NATGASMINI": "NG=F"
}

VIX_TICKERS = {
    "NIFTY": "^INDIAVIX",
    "BANKNIFTY": "^INDIAVIX",
    "SENSEX": "^INDIAVIX",
    "FINNIFTY": "^INDIAVIX",
    "MIDCPNIFTY": "^INDIAVIX",
    "RELIANCE": "^INDIAVIX",
    "SBIN": "^INDIAVIX",
    "ITC": "^INDIAVIX",
    "SPY": "^VIX",
    "AAPL": "^VIX",
    "TSLA": "^VIX",
    "CRUDEOIL": "^OVX",
    "CRUDEOILM": "^OVX",
    "SILVER": "^VXSLV",
    "SILVERM": "^VXSLV",
    "GOLD": "^GVZ",
    "GOLDM": "^GVZ",
    "NATURALGAS": "^VIX",
    "NATGASMINI": "^VIX"
}

# Standard strike rounding intervals for cleaner option grids
STRIKE_ROUND_INTERVALS = {
    "NIFTY": 50,
    "BANKNIFTY": 100,
    "SENSEX": 100,
    "FINNIFTY": 100,
    "MIDCPNIFTY": 50,
    "RELIANCE": 10,
    "SBIN": 5,
    "ITC": 2.5,
    "SPY": 1,
    "AAPL": 1,
    "TSLA": 1,
    "GOLD": 1000,
    "GOLDM": 1000,
    "SILVER": 1000,
    "SILVERM": 1000,
    "CRUDEOIL": 50,
    "CRUDEOILM": 50,
    "NATURALGAS": 10,
    "NATGASMINI": 10
}

class OptionLegSchema(BaseModel):
    action: str  # "BUY" or "SELL"
    optionType: str  # "C" or "P"
    strikeOffset: float  # e.g., 0 for ATM, 100 for +100 OTM Call
    quantity: int

class BacktestRequest(BaseModel):
    symbol: str
    startDate: str
    endDate: str
    legs: List[OptionLegSchema]
    entryDaysOfWeek: List[int] = [1]  # 1 = Tuesday (standard weekly entry day)
    exitDaysBeforeExpiry: int = 0
    slippagePerLeg: float = 0.0
    initialCapital: float = 100000.0
    backtestType: str = "EOD"  # "EOD" or "INTRADAY"
    entryTime: str = "09:20"
    exitTime: str = "15:15"
    legStopLossPct: Optional[float] = None
    legTakeProfitPct: Optional[float] = None
    portfolioStopLoss: Optional[float] = None
    portfolioTakeProfit: Optional[float] = None
    takeProfitPct: Optional[float] = None
    stopLossPct: Optional[float] = None
    trailingSL: Optional[bool] = False
    trailingSLTrigger: Optional[float] = None
    trailingSLStep: Optional[float] = None
    intradayInterval: Optional[int] = 5
    expiryType: str = "weekly"

class OptimizationRequest(BaseModel):
    symbol: str
    startDate: str
    endDate: str
    legs: List[OptionLegSchema]
    initialCapital: float = 100000.0
    backtestType: str = "EOD"  # "EOD" or "INTRADAY"
    slippagePerLeg: float = 50.0
    expiryType: str = "weekly"
    
    # Ranges of parameters to sweep
    takeProfitPctRange: Optional[List[Optional[float]]] = None
    stopLossPctRange: Optional[List[Optional[float]]] = None
    entryTimeRange: Optional[List[str]] = None
    exitTimeRange: Optional[List[str]] = None
    entryDaysRange: Optional[List[List[int]]] = None
    strikeWidthRange: Optional[List[float]] = None
    
    # Goal parameter: "netPnL", "winRate", "maxDrawdown", "sharpeRatio", "profitFactor"
    objective: str = "netPnL"


LOT_SIZES = {
    "NIFTY": 65,
    "BANKNIFTY": 30,
    "SENSEX": 20,
    "FINNIFTY": 60,
    "MIDCPNIFTY": 120,
    "RELIANCE": 250,
    "HDFCBANK": 550,
    "SBIN": 750,
    "ITC": 1600,
    "GOLD": 100,
    "GOLDM": 10,
    "SILVER": 30,
    "SILVERM": 5,
    "CRUDEOIL": 100,
    "CRUDEOILM": 10,
    "NATURALGAS": 1250,
    "NATGASMINI": 250,
    "SPY": 100,
    "AAPL": 100,
    "TSLA": 100
}


def get_expiry_date(date_obj: datetime, symbol: str, expiry_type: str = "weekly") -> datetime:
    import calendar
    etype = str(expiry_type).lower()
    symbol_upper = symbol.upper()
    
    is_crypto = symbol_upper in ["BTC", "ETH", "SOL"]
    
    if is_crypto:
        if etype in ("daily", "+1 day", "1d", "+1d"):
            return date_obj + timedelta(days=1)
        elif etype in ("+2 day", "2d", "+2d"):
            return date_obj + timedelta(days=2)
        elif etype in ("+3 day", "3d", "+3d"):
            return date_obj + timedelta(days=3)
        elif etype in ("+4 day", "4d", "+4d"):
            return date_obj + timedelta(days=4)
        elif etype in ("+5 day", "5d", "+5d"):
            return date_obj + timedelta(days=5)
        elif etype in ("+6 day", "6d", "+6d"):
            return date_obj + timedelta(days=6)
            
    if symbol_upper in ["SPY", "AAPL", "TSLA"] or is_crypto:
        target_w = 4 # Friday
    elif symbol_upper == "NIFTY":
        target_w = 1 # Tuesday
    elif symbol_upper == "BANKNIFTY":
        target_w = 2 # Wednesday
    elif symbol_upper == "SENSEX":
        target_w = 3 # Thursday
    elif symbol_upper == "FINNIFTY":
        target_w = 1 # Tuesday
    elif symbol_upper == "MIDCPNIFTY":
        target_w = 0 # Monday
    else:
        target_w = 3 # Thursday (Standard NSE Stock/Index)

    if etype == "weekly":
        days_ahead = (target_w - date_obj.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        return date_obj + timedelta(days=days_ahead)
    elif etype == "monthly":
        curr_year = date_obj.year
        curr_month = date_obj.month
        
        def get_last_weekday(year, month, weekday):
            last_day = calendar.monthrange(year, month)[1]
            dt = datetime(year, month, last_day)
            while dt.weekday() != weekday:
                dt -= timedelta(days=1)
            return dt
            
        last_target_day = get_last_weekday(curr_year, curr_month, target_w)
        if date_obj.date() >= last_target_day.date():
            next_month = curr_month + 1
            next_year = curr_year
            if next_month > 12:
                next_month = 1
                next_year += 1
            last_target_day = get_last_weekday(next_year, next_month, target_w)
        return last_target_day
    else:
        days_ahead = (target_w - date_obj.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        return date_obj + timedelta(days=days_ahead)

def get_nearest_expiry(date_obj: datetime, symbol: str) -> datetime:
    return get_expiry_date(date_obj, symbol, "weekly")

def compute_strategy_max_profit_loss(legs: list, entry_spot: float, lot_size: int) -> tuple:
    """
    Computes theoretical max profit and max loss of a strategy at expiration
    by evaluating payoffs at spot=0, each strike, and spot=entry_spot * 3.
    """
    strikes = [leg["strike"] for leg in legs]
    candidate_spots = [0.0] + strikes + [entry_spot * 3.0]
    
    payoffs = []
    for S in candidate_spots:
        total_pnl = 0.0
        for leg in legs:
            strike = leg["strike"]
            qty = leg["quantity"]
            entry_premium = leg["entryPremium"]
            opt_type = leg["optionType"]
            
            if opt_type == 'C':
                expiry_price = max(0.0, S - strike)
            else:
                expiry_price = max(0.0, strike - S)
                
            if leg["action"] == "BUY":
                leg_pnl = (expiry_price - entry_premium) * qty * lot_size
            else:
                leg_pnl = (entry_premium - expiry_price) * qty * lot_size
            total_pnl += leg_pnl
        payoffs.append(total_pnl)
        
    net_c_qty = 0
    for leg in legs:
        qty = leg["quantity"]
        action_sign = 1 if leg["action"] == "BUY" else -1
        if leg["optionType"] == 'C':
            net_c_qty += action_sign * qty
            
    is_profit_unlimited = False
    is_loss_unlimited = False
    
    if net_c_qty > 0:
        is_profit_unlimited = True
    elif net_c_qty < 0:
        is_loss_unlimited = True
        
    max_val = max(payoffs)
    min_val = min(payoffs)
    
    max_profit = float('inf') if is_profit_unlimited else max_val
    max_loss = float('inf') if is_loss_unlimited else -min_val
    
    return max_profit, max_loss

def run_in_memory_eod_backtest(
    dates_list: list,
    spot_series: pd.Series,
    vix_series: pd.Series,
    legs: list,
    entry_days: list,
    slippage: float,
    initial_capital: float,
    take_profit_pct: Optional[float],
    stop_loss_pct: Optional[float],
    lot_size: int,
    strike_round: int,
    expiry_type: str = "weekly",
    symbol: str = "NIFTY"
) -> dict:
    capital = initial_capital
    r = 0.065
    current_position = None
    trades_log = []
    
    for i, dt in enumerate(dates_list):
        date_str = dt.strftime("%Y-%m-%d")
        spot_price = float(spot_series.loc[dt])
        vix_val = float(vix_series.loc[dt])
        base_iv = vix_val / 100.0
        
        if current_position is not None:
            expiry_date = current_position["expiryDate"]
            is_expiry_day = dt >= expiry_date
            
            days_left = max(0, (expiry_date - dt).days)
            T_years = days_left / 365.0
            
            legs_pnl = 0
            for leg in current_position["legs"]:
                strike = leg["strike"]
                option_type = leg["optionType"]
                qty = leg["quantity"]
                entry_premium = leg["entryPremium"]
                
                dist_pct = (strike - spot_price) / spot_price
                leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
                leg_iv = max(0.05, min(1.0, leg_iv))
                
                if T_years <= 0:
                    current_prem = max(0.0, spot_price - strike) if option_type == 'C' else max(0.0, strike - spot_price)
                else:
                    current_prem = bs_pricing(spot_price, strike, T_years, r, leg_iv, option_type)
                    
                if leg["action"] == "BUY":
                    leg_return = current_prem - entry_premium
                else:
                    leg_return = entry_premium - current_prem
                legs_pnl += leg_return * qty * lot_size
                
            exit_needed = False
            if is_expiry_day:
                exit_needed = True
            else:
                sl_val = current_position.get("activePortfolioSL")
                tp_val = current_position.get("activePortfolioTP")
                if sl_val is not None and legs_pnl <= -sl_val:
                    exit_needed = True
                elif tp_val is not None and legs_pnl >= tp_val:
                    exit_needed = True
 
            exit_slippage = sum(leg["quantity"] * slippage for leg in current_position["legs"]) if exit_needed else 0.0
            net_pnl = legs_pnl - exit_slippage
 
            if exit_needed:
                capital += net_pnl
                trades_log.append(net_pnl)
                current_position = None
                
        if current_position is None:
            if dt.weekday() in entry_days:
                expiry_dt = get_expiry_date(dt, symbol, expiry_type)
                days_to_expiry = max(1, (expiry_dt - dt).days)
                T_years = days_to_expiry / 365.0
                
                atm_strike = round(spot_price / strike_round) * strike_round
                legs_data = []
                for leg_schema in legs:
                    strike = atm_strike + leg_schema.strikeOffset
                    
                    dist_pct = (strike - spot_price) / spot_price
                    leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
                    leg_iv = max(0.05, min(1.0, leg_iv))
                    
                    entry_prem = bs_pricing(spot_price, strike, T_years, r, leg_iv, leg_schema.optionType)
                    legs_data.append({
                        "action": leg_schema.action,
                        "optionType": leg_schema.optionType,
                        "strike": strike,
                        "quantity": leg_schema.quantity,
                        "entryPremium": entry_prem
                    })
                    
                max_profit, max_loss = compute_strategy_max_profit_loss(legs_data, spot_price, lot_size)
                active_portfolio_tp = None
                active_portfolio_sl = None

                if take_profit_pct is not None and max_profit != float('inf'):
                    active_portfolio_tp = max_profit * (take_profit_pct / 100.0)
                if stop_loss_pct is not None and max_loss != float('inf'):
                    active_portfolio_sl = max_loss * (stop_loss_pct / 100.0)

                current_position = {
                    "expiryDate": expiry_dt,
                    "legs": legs_data,
                    "activePortfolioSL": active_portfolio_sl,
                    "activePortfolioTP": active_portfolio_tp
                }

    total_trades = len(trades_log)
    if total_trades > 0:
        winning = [p for p in trades_log if p > 0]
        losing = [p for p in trades_log if p <= 0]
        win_rate = (len(winning) / total_trades) * 100.0
        net_return = capital - initial_capital
        net_return_pct = (net_return / initial_capital) * 100.0
        
        peak = initial_capital
        running = initial_capital
        max_dd = 0.0
        for p in trades_log:
            running += p
            if running > peak:
                peak = running
            dd = (peak - running) / peak * 100.0
            if dd > max_dd:
                max_dd = dd
        
        profit_factor = sum(winning) / abs(sum(losing)) if losing and sum(losing) != 0 else float("inf")
    else:
        win_rate = 0.0
        net_return = 0.0
        net_return_pct = 0.0
        max_dd = 0.0
        profit_factor = 0.0
        
    return {
        "netPnL": round(net_return, 2),
        "netReturnPct": round(net_return_pct, 2),
        "winRate": round(win_rate, 2),
        "maxDrawdown": round(max_dd, 2),
        "profitFactor": round(profit_factor, 2) if profit_factor != float("inf") else "Unlimited",
        "totalTrades": total_trades
    }

def run_in_memory_intraday_backtest(
    sorted_days: list,
    day_candles: dict,
    vix_series: pd.Series,
    legs: list,
    entry_days: list,
    entry_h: int, entry_m: int,
    exit_h: int, exit_m: int,
    slippage: float,
    initial_capital: float,
    take_profit_pct: Optional[float],
    stop_loss_pct: Optional[float],
    lot_size: int,
    strike_round: int,
    expiry_type: str = "weekly",
    symbol: str = "NIFTY"
) -> dict:
    capital = initial_capital
    r = 0.065
    trades_log = []
    
    for date_str in sorted_days:
        candles_for_day = day_candles[date_str]
        
        filtered_candles = []
        for c in candles_for_day:
            time_part = c["timestamp"].split(" ")[1]
            h, m = map(int, time_part.split(":")[:2])
            candle_time_mins = h * 60 + m
            entry_time_mins = entry_h * 60 + entry_m
            exit_time_mins = exit_h * 60 + exit_m
            if entry_time_mins <= candle_time_mins <= exit_time_mins:
                filtered_candles.append(c)
 
        if not filtered_candles:
            continue
 
        dt_obj = datetime.strptime(date_str, "%Y-%m-%d")
        if dt_obj.weekday() not in entry_days:
            continue
 
        try:
            vix_val = float(vix_series.loc[pd.to_datetime(date_str)])
        except:
            vix_val = 15.0
        base_iv = vix_val / 100.0
 
        entry_candle = filtered_candles[0]
        entry_spot = entry_candle["open"]
        atm_strike = round(entry_spot / strike_round) * strike_round
        expiry_dt = get_expiry_date(dt_obj, symbol, expiry_type)
        
        def get_dte_years(candle_dt_str: str, expiry_date: datetime) -> float:
            cdt = datetime.strptime(candle_dt_str, "%Y-%m-%d %H:%M:%S")
            days_diff = (expiry_date.date() - cdt.date()).days
            close_time = cdt.replace(hour=15, minute=30, second=0)
            seconds_left_today = max(0, (close_time - cdt).total_seconds())
            fractional_day = seconds_left_today / (24 * 3600)
            return max(0.0001, (days_diff - 1 + fractional_day) / 365.0) if days_diff > 0 else max(0.0, seconds_left_today / (365 * 24 * 3600))

        entry_T = get_dte_years(entry_candle["timestamp"], expiry_dt)
        
        legs_data = []
        for leg_schema in legs:
            strike = atm_strike + leg_schema.strikeOffset
            dist_pct = (strike - entry_spot) / entry_spot
            leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
            leg_iv = max(0.05, min(1.0, leg_iv))
            
            entry_prem = bs_pricing(entry_spot, strike, entry_T, r, leg_iv, leg_schema.optionType)
            legs_data.append({
                "action": leg_schema.action,
                "optionType": leg_schema.optionType,
                "strike": strike,
                "quantity": leg_schema.quantity,
                "entryPremium": entry_prem,
                "status": "ACTIVE"
            })
            
        max_profit, max_loss = compute_strategy_max_profit_loss(legs_data, entry_spot, lot_size)
        active_portfolio_tp = None
        active_portfolio_sl = None

        if take_profit_pct is not None and max_profit != float('inf'):
            active_portfolio_tp = max_profit * (take_profit_pct / 100.0)
        if stop_loss_pct is not None and max_loss != float('inf'):
            active_portfolio_sl = max_loss * (stop_loss_pct / 100.0)

        trade_exited = False
        final_trade_pnl = 0.0
        
        for candle in filtered_candles[1:]:
            spot_val = candle["close"]
            timestamp_str = candle["timestamp"]
            current_T = get_dte_years(timestamp_str, expiry_dt)
            
            running_pnl = 0.0
            for leg in legs_data:
                strike = leg["strike"]
                option_type = leg["optionType"]
                qty = leg["quantity"]
                entry_premium = leg["entryPremium"]
                
                dist_pct = (strike - spot_val) / spot_val
                leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
                leg_iv = max(0.05, min(1.0, leg_iv))
                
                if current_T <= 0:
                    current_prem = max(0.0, spot_val - strike) if option_type == 'C' else max(0.0, strike - spot_val)
                else:
                    current_prem = bs_pricing(spot_val, strike, current_T, r, leg_iv, option_type)
                
                if leg["action"] == "BUY":
                    leg_ret = current_prem - entry_premium
                else:
                    leg_ret = entry_premium - current_prem
                running_pnl += leg_ret * qty * lot_size
            
            exit_needed = False
            if active_portfolio_sl is not None and running_pnl <= -active_portfolio_sl:
                exit_needed = True
            elif active_portfolio_tp is not None and running_pnl >= active_portfolio_tp:
                exit_needed = True
                
            if exit_needed:
                exit_slippage = sum(leg["quantity"] * slippage for leg in legs_data)
                final_trade_pnl = running_pnl - exit_slippage
                trade_exited = True
                break

        if not trade_exited:
            last_candle = filtered_candles[-1]
            spot_val = last_candle["close"]
            timestamp_str = last_candle["timestamp"]
            current_T = get_dte_years(timestamp_str, expiry_dt)
            
            running_pnl = 0.0
            for leg in legs_data:
                strike = leg["strike"]
                option_type = leg["optionType"]
                qty = leg["quantity"]
                entry_premium = leg["entryPremium"]
                
                dist_pct = (strike - spot_val) / spot_val
                leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
                leg_iv = max(0.05, min(1.0, leg_iv))
                
                if current_T <= 0:
                    current_prem = max(0.0, spot_val - strike) if option_type == 'C' else max(0.0, strike - spot_val)
                else:
                    current_prem = bs_pricing(spot_val, strike, current_T, r, leg_iv, option_type)
                
                if leg["action"] == "BUY":
                    leg_ret = current_prem - entry_premium
                else:
                    leg_ret = entry_premium - current_prem
                running_pnl += leg_ret * qty * lot_size
            exit_slippage = sum(leg["quantity"] * slippage for leg in legs_data)
            final_trade_pnl = running_pnl - exit_slippage

        capital += final_trade_pnl
        trades_log.append(final_trade_pnl)

    total_trades = len(trades_log)
    if total_trades > 0:
        winning = [p for p in trades_log if p > 0]
        losing = [p for p in trades_log if p <= 0]
        win_rate = (len(winning) / total_trades) * 100.0
        net_return = capital - initial_capital
        net_return_pct = (net_return / initial_capital) * 100.0
        
        peak = initial_capital
        running = initial_capital
        max_dd = 0.0
        for p in trades_log:
            running += p
            if running > peak:
                peak = running
            dd = (peak - running) / peak * 100.0
            if dd > max_dd:
                max_dd = dd
        
        profit_factor = sum(winning) / abs(sum(losing)) if losing and sum(losing) != 0 else float("inf")
    else:
        win_rate = 0.0
        net_return = 0.0
        net_return_pct = 0.0
        max_dd = 0.0
        profit_factor = 0.0
        
    return {
        "netPnL": round(net_return, 2),
        "netReturnPct": round(net_return_pct, 2),
        "winRate": round(win_rate, 2),
        "maxDrawdown": round(max_dd, 2),
        "profitFactor": round(profit_factor, 2) if profit_factor != float("inf") else "Unlimited",
        "totalTrades": total_trades
    }

async def run_intraday_backtest(req: BacktestRequest):
    symbol_upper = req.symbol.upper()
    lot_size = LOT_SIZES.get(symbol_upper, 100)
    strike_round = STRIKE_ROUND_INTERVALS.get(symbol_upper, 50)
    r = 0.065  # standard interest rate (6.5%)
    
    # 1. Fetch intraday candles (spot) from MarketDataService
    print(f"[Intraday Backtester] Fetching intraday candles for {symbol_upper}...")
    try:
        interval = req.intradayInterval or 5
        raw_candles = market_service.get_historical_intraday_candles(
            symbol=symbol_upper,
            interval=interval,
            from_date=req.startDate,
            to_date=req.endDate
        )
        if not raw_candles:
            raise HTTPException(
                status_code=400, 
                detail=f"No intraday spot price data found for ticker {symbol_upper}. Note: Without Dhan API credentials, historical intraday backtests are limited to the past 30-60 days due to Yahoo Finance provider limits. Please shorten your date range (e.g. to the last 30 days) or switch to EOD mode for longer periods."
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load intraday spot prices: {str(e)}")

    # Group candles by trading day
    from collections import defaultdict
    day_candles = defaultdict(list)
    for c in raw_candles:
        date_str = c["timestamp"].split(" ")[0]
        day_candles[date_str].append(c)

    # Load VIX data to use as daily base IV
    vix_ticker = VIX_TICKERS.get(symbol_upper, "^VIX")
    try:
        vix_df = yf.download(vix_ticker, start=req.startDate, end=req.endDate)
        if vix_df.empty:
            vix_series = pd.Series(15.0, index=pd.to_datetime(list(day_candles.keys())))
        else:
            if isinstance(vix_df.columns, pd.MultiIndex):
                vix_df.columns = vix_df.columns.get_level_values(0)
            vix_series = vix_df["Close"].dropna()
    except Exception:
        vix_series = pd.Series(15.0, index=pd.to_datetime(list(day_candles.keys())))

    capital = req.initialCapital
    equity_curve = []
    trades_log = []
    monthly_pnl = {}

    sorted_days = sorted(list(day_candles.keys()))
    
    entry_h, entry_m = map(int, req.entryTime.split(":"))
    exit_h, exit_m = map(int, req.exitTime.split(":"))

    for date_str in sorted_days:
        candles_for_day = day_candles[date_str]
        candles_for_day = sorted(candles_for_day, key=lambda x: x["timestamp"])
        
        filtered_candles = []
        for c in candles_for_day:
            time_part = c["timestamp"].split(" ")[1]
            h, m = map(int, time_part.split(":")[:2])
            candle_time_mins = h * 60 + m
            entry_time_mins = entry_h * 60 + entry_m
            exit_time_mins = exit_h * 60 + exit_m
            if entry_time_mins <= candle_time_mins <= exit_time_mins:
                filtered_candles.append(c)

        if not filtered_candles:
            equity_curve.append({
                "date": date_str,
                "equity": round(capital, 2),
                "spot": float(candles_for_day[-1]["close"])
            })
            continue

        dt_obj = datetime.strptime(date_str, "%Y-%m-%d")
        if dt_obj.weekday() not in req.entryDaysOfWeek:
            equity_curve.append({
                "date": date_str,
                "equity": round(capital, 2),
                "spot": float(filtered_candles[-1]["close"])
            })
            continue

        try:
            vix_val = float(vix_series.loc[pd.to_datetime(date_str)])
        except KeyError:
            try:
                vix_val = float(vix_series.reindex([pd.to_datetime(date_str)], method="ffill").iloc[0])
            except:
                vix_val = 15.0
        base_iv = vix_val / 100.0

        entry_candle = filtered_candles[0]
        entry_spot = entry_candle["open"]
        atm_strike = round(entry_spot / strike_round) * strike_round
        expiry_dt = get_expiry_date(dt_obj, symbol_upper, req.expiryType)
        
        def get_dte_years(candle_dt_str: str, expiry_date: datetime) -> float:
            cdt = datetime.strptime(candle_dt_str, "%Y-%m-%d %H:%M:%S")
            days_diff = (expiry_date.date() - cdt.date()).days
            close_time = cdt.replace(hour=15, minute=30, second=0)
            seconds_left_today = max(0, (close_time - cdt).total_seconds())
            fractional_day = seconds_left_today / (24 * 3600)
            return max(0.0001, (days_diff - 1 + fractional_day) / 365.0) if days_diff > 0 else max(0.0, seconds_left_today / (365 * 24 * 3600))

        entry_T = get_dte_years(entry_candle["timestamp"], expiry_dt)
        
        legs_data = []
        total_entry_cost = 0
        
        for leg_schema in req.legs:
            strike = atm_strike + leg_schema.strikeOffset
            dist_pct = (strike - entry_spot) / entry_spot
            leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
            leg_iv = max(0.05, min(1.0, leg_iv))
            
            entry_prem = bs_pricing(entry_spot, strike, entry_T, r, leg_iv, leg_schema.optionType)
            
            legs_data.append({
                "action": leg_schema.action,
                "optionType": leg_schema.optionType,
                "strike": strike,
                "quantity": leg_schema.quantity,
                "entryPremium": entry_prem,
                "status": "ACTIVE",
                "exitPremium": None
            })
            
            if leg_schema.action == "BUY":
                total_entry_cost += (entry_prem * lot_size + req.slippagePerLeg) * leg_schema.quantity
            else:
                total_entry_cost -= (entry_prem * lot_size - req.slippagePerLeg) * leg_schema.quantity

        current_position = {
            "entryDate": date_str,
            "entryTime": entry_candle["timestamp"].split(" ")[1],
            "entrySpot": entry_spot,
            "expiryDate": expiry_dt,
            "legs": legs_data,
            "entryCost": total_entry_cost,
            "exitTime": None,
            "exitSpot": None,
            "exitReason": "Market Close",
            "netPnL": 0.0
        }

        # Determine active portfolio SL/TP in Rupees
        max_profit, max_loss = compute_strategy_max_profit_loss(legs_data, entry_spot, lot_size)
        active_portfolio_tp = req.portfolioTakeProfit
        active_portfolio_sl = req.portfolioStopLoss

        if req.takeProfitPct is not None and max_profit != float('inf'):
            pct_tp = max_profit * (req.takeProfitPct / 100.0)
            if active_portfolio_tp is None or pct_tp < active_portfolio_tp:
                active_portfolio_tp = pct_tp
        
        if req.stopLossPct is not None and max_loss != float('inf'):
            pct_sl = max_loss * (req.stopLossPct / 100.0)
            if active_portfolio_sl is None or pct_sl < active_portfolio_sl:
                active_portfolio_sl = pct_sl

        trade_exited = False
        max_profit_reached = 0.0
        
        for candle in filtered_candles[1:]:
            spot_val = candle["close"]
            timestamp_str = candle["timestamp"]
            current_T = get_dte_years(timestamp_str, expiry_dt)
            
            running_pnl = 0.0
            leg_prices = []
            
            for leg in current_position["legs"]:
                if leg["status"] == "SQUARED_OFF":
                    leg_pnl = leg["realizedPnL"]
                    running_pnl += leg_pnl
                    leg_prices.append(leg["exitPremium"])
                    continue
                
                strike = leg["strike"]
                option_type = leg["optionType"]
                qty = leg["quantity"]
                entry_premium = leg["entryPremium"]
                
                dist_pct = (strike - spot_val) / spot_val
                leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
                leg_iv = max(0.05, min(1.0, leg_iv))
                
                if current_T <= 0:
                    current_prem = max(0.0, spot_val - strike) if option_type == 'C' else max(0.0, strike - spot_val)
                else:
                    current_prem = bs_pricing(spot_val, strike, current_T, r, leg_iv, option_type)
                
                leg_prices.append(current_prem)
                
                leg_sl_hit = False
                leg_tp_hit = False
                
                if leg["action"] == "BUY":
                    leg_ret = current_prem - entry_premium
                    if req.legStopLossPct is not None:
                        if current_prem <= entry_premium * (1 - req.legStopLossPct / 100.0):
                            leg_sl_hit = True
                    if req.legTakeProfitPct is not None:
                        if current_prem >= entry_premium * (1 + req.legTakeProfitPct / 100.0):
                            leg_tp_hit = True
                else:
                    leg_ret = entry_premium - current_prem
                    if req.legStopLossPct is not None:
                        if current_prem >= entry_premium * (1 + req.legStopLossPct / 100.0):
                            leg_sl_hit = True
                    if req.legTakeProfitPct is not None:
                        if current_prem <= entry_premium * (1 - req.legTakeProfitPct / 100.0):
                            leg_tp_hit = True
                
                if leg_sl_hit or leg_tp_hit:
                    exit_sl = qty * req.slippagePerLeg
                    leg["status"] = "SQUARED_OFF"
                    leg["exitPremium"] = current_prem
                    leg["realizedPnL"] = leg_ret * qty * lot_size - exit_sl
                    leg_pnl = leg["realizedPnL"]
                    running_pnl += leg_pnl
                    print(f"[Intraday Loop] Leg {option_type} {strike} hit SL/TP. Closed at {current_prem}")
                else:
                    running_pnl += leg_ret * qty * lot_size
            
            max_profit_reached = max(max_profit_reached, running_pnl)
            
            trailing_sl_level = None
            if req.trailingSL and req.trailingSLTrigger is not None and req.trailingSLStep is not None:
                if max_profit_reached >= req.trailingSLTrigger:
                    base_sl = -active_portfolio_sl if active_portfolio_sl is not None else 0.0
                    steps = math.floor((max_profit_reached - req.trailingSLTrigger) / req.trailingSLStep)
                    trailing_sl_level = base_sl + steps * req.trailingSLStep
            
            exit_needed = False
            exit_reason = "Market Close"
            
            if active_portfolio_sl is not None and running_pnl <= -active_portfolio_sl:
                exit_needed = True
                exit_reason = "Portfolio SL"
            elif active_portfolio_tp is not None and running_pnl >= active_portfolio_tp:
                exit_needed = True
                exit_reason = "Portfolio TP"
            elif trailing_sl_level is not None and running_pnl <= trailing_sl_level:
                exit_needed = True
                exit_reason = "Trailing SL"
                
            all_squared_off = all(leg["status"] == "SQUARED_OFF" for leg in current_position["legs"])
            if all_squared_off:
                exit_needed = True
                exit_reason = "Leg SL/TP Hit"

            if exit_needed:
                total_exit_slippage = 0.0
                final_legs_pnl = 0.0
                
                for leg, current_prem in zip(current_position["legs"], leg_prices):
                    qty = leg["quantity"]
                    entry_premium = leg["entryPremium"]
                    
                    if leg["status"] == "ACTIVE":
                        leg["status"] = "SQUARED_OFF"
                        leg["exitPremium"] = current_prem
                        
                        if leg["action"] == "BUY":
                            leg_ret = current_prem - entry_premium
                        else:
                            leg_ret = entry_premium - current_prem
                        
                        exit_sl = qty * req.slippagePerLeg
                        total_exit_slippage += exit_sl
                        leg["realizedPnL"] = leg_ret * qty * lot_size - exit_sl
                        
                    final_legs_pnl += leg["realizedPnL"]
                    
                current_position["exitTime"] = timestamp_str.split(" ")[1]
                current_position["exitSpot"] = spot_val
                current_position["exitReason"] = exit_reason
                current_position["netPnL"] = final_legs_pnl
                trade_exited = True
                break

        if not trade_exited:
            last_candle = filtered_candles[-1]
            spot_val = last_candle["close"]
            timestamp_str = last_candle["timestamp"]
            current_T = get_dte_years(timestamp_str, expiry_dt)
            
            final_legs_pnl = 0.0
            
            for leg in current_position["legs"]:
                if leg["status"] == "ACTIVE":
                    leg["status"] = "SQUARED_OFF"
                    strike = leg["strike"]
                    option_type = leg["optionType"]
                    qty = leg["quantity"]
                    entry_premium = leg["entryPremium"]
                    
                    dist_pct = (strike - spot_val) / spot_val
                    leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
                    leg_iv = max(0.05, min(1.0, leg_iv))
                    
                    if current_T <= 0:
                        current_prem = max(0.0, spot_val - strike) if option_type == 'C' else max(0.0, strike - spot_val)
                    else:
                        current_prem = bs_pricing(spot_val, strike, current_T, r, leg_iv, option_type)
                    
                    leg["exitPremium"] = current_prem
                    
                    if leg["action"] == "BUY":
                        leg_ret = current_prem - entry_premium
                    else:
                        leg_ret = entry_premium - current_prem
                        
                    exit_sl = qty * req.slippagePerLeg
                    leg["realizedPnL"] = leg_ret * qty * lot_size - exit_sl
                    
                final_legs_pnl += leg["realizedPnL"]
                
            current_position["exitTime"] = timestamp_str.split(" ")[1]
            current_position["exitSpot"] = spot_val
            current_position["exitReason"] = "Exit Time reached"
            current_position["netPnL"] = final_legs_pnl

        net_trade_pnl = current_position["netPnL"]
        capital += net_trade_pnl
        trades_log.append(current_position)
        
        year_month = dt_obj.strftime("%Y-%m")
        monthly_pnl[year_month] = monthly_pnl.get(year_month, 0.0) + net_trade_pnl
        
        equity_curve.append({
            "date": date_str,
            "equity": round(capital, 2),
            "spot": float(filtered_candles[-1]["close"])
        })

    total_trades = len(trades_log)
    if total_trades > 0:
        winning_trades = [t for t in trades_log if t["netPnL"] > 0]
        losing_trades = [t for t in trades_log if t["netPnL"] <= 0]
        
        win_rate = (len(winning_trades) / total_trades) * 100.0
        total_profit = sum(t["netPnL"] for t in winning_trades)
        total_loss = abs(sum(t["netPnL"] for t in losing_trades))
        
        profit_factor = total_profit / total_loss if total_loss > 0 else float("inf")
        net_return = capital - req.initialCapital
        net_return_pct = (net_return / req.initialCapital) * 100.0
        
        peak = req.initialCapital
        max_dd = 0.0
        for eq_point in equity_curve:
            val = eq_point["equity"]
            if val > peak:
                peak = val
            dd = (peak - val) / peak * 100.0
            if dd > max_dd:
                max_dd = dd
                
        daily_returns = []
        for j in range(1, len(equity_curve)):
            ret = (equity_curve[j]["equity"] - equity_curve[j-1]["equity"]) / equity_curve[j-1]["equity"]
            daily_returns.append(ret)
        
        if len(daily_returns) > 0 and np.std(daily_returns) > 0:
            sharpe = (np.mean(daily_returns) / np.std(daily_returns)) * math.sqrt(252)
        else:
            sharpe = 0.0
    else:
        win_rate = 0.0
        profit_factor = 0.0
        net_return = 0.0
        net_return_pct = 0.0
        max_dd = 0.0
        sharpe = 0.0

    monthly_grid = []
    years_seen = sorted(list(set(datetime.strptime(ym, "%Y-%m").year for ym in monthly_pnl.keys())))
    
    for yr in years_seen:
        row = {"year": yr}
        annual_total = 0.0
        for m in range(1, 13):
            key = f"{yr}-{m:02d}"
            val = monthly_pnl.get(key, 0.0)
            row[f"m{m}"] = round(val, 2)
            annual_total += val
        row["total"] = round(annual_total, 2)
        monthly_grid.append(row)

    return {
        "metrics": {
            "initialCapital": req.initialCapital,
            "finalCapital": round(capital, 2),
            "netPnL": round(net_return, 2),
            "netReturnPct": round(net_return_pct, 2),
            "winRate": round(win_rate, 2),
            "profitFactor": round(profit_factor, 2) if profit_factor != float("inf") else "Unlimited",
            "maxDrawdown": round(max_dd, 2),
            "sharpeRatio": round(sharpe, 2),
            "totalTrades": total_trades
        },
        "equityCurve": equity_curve,
        "monthlyGrid": monthly_grid,
        "trades": [
            {
                "entryDate": f"{t['entryDate']} {t['entryTime']}",
                "entrySpot": round(t["entrySpot"], 2),
                "exitDate": f"{t['entryDate']} {t['exitTime']}" if t['exitTime'] else t['entryDate'],
                "exitSpot": round(t["exitSpot"], 2) if t["exitSpot"] else round(t["entrySpot"], 2),
                "exitReason": t["exitReason"],
                "netPnL": round(t["netPnL"], 2)
            }
            for t in trades_log
        ]
    }

@router.post("/run")
async def run_backtest(req: BacktestRequest):
    if req.symbol.upper().endswith("1!"):
        req.symbol = req.symbol[:-2]
    symbol_upper = req.symbol.upper()
    if req.backtestType.upper() == "INTRADAY":
        return await run_intraday_backtest(req)
        
    spot_ticker = SPOT_TICKERS.get(symbol_upper, symbol_upper)
    vix_ticker = VIX_TICKERS.get(symbol_upper, "^VIX")
    lot_size = LOT_SIZES.get(symbol_upper, 100)
    
    # 1. Fetch historical spot and VIX quotes from yfinance
    print(f"[Backtester] Fetching historical spot data for {spot_ticker}...")
    try:
        spot_df = yf.download(spot_ticker, start=req.startDate, end=req.endDate)
        if spot_df.empty:
            raise HTTPException(status_code=400, detail=f"No spot price data found for ticker {spot_ticker}")
            
        # Standardize columns to handle multi-index headers from yfinance download
        if isinstance(spot_df.columns, pd.MultiIndex):
            spot_df.columns = spot_df.columns.get_level_values(0)
            
        spot_series = spot_df["Close"].dropna()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download spot prices: {str(e)}")
        
    print(f"[Backtester] Fetching historical VIX data for {vix_ticker}...")
    try:
        vix_df = yf.download(vix_ticker, start=req.startDate, end=req.endDate)
        if vix_df.empty:
            # Fallback to constant VIX if download fails
            vix_series = pd.Series(15.0, index=spot_series.index)
        else:
            if isinstance(vix_df.columns, pd.MultiIndex):
                vix_df.columns = vix_df.columns.get_level_values(0)
            vix_series = vix_df["Close"].dropna()
            # Align indices
            vix_series = vix_series.reindex(spot_series.index, method="ffill").fillna(15.0)
    except Exception:
        vix_series = pd.Series(15.0, index=spot_series.index)

    # 2. Setup Backtest variables
    dates_list = spot_series.index.tolist()
    capital = req.initialCapital
    equity_curve = []
    trades_log = []
    
    current_position = None  # Holds active trade details
    r = 0.065  # risk free rate (6.5%)
    strike_round = STRIKE_ROUND_INTERVALS.get(symbol_upper, 50)

    
    # Track monthly P&L
    monthly_pnl = {}
    
    for i, dt in enumerate(dates_list):
        date_str = dt.strftime("%Y-%m-%d")
        spot_price = float(spot_series.loc[dt])
        vix_val = float(vix_series.loc[dt])
        base_iv = vix_val / 100.0
        
        # A. If we have an active position, update MTM and check for exit/expiry
        if current_position is not None:
            expiry_date = current_position["expiryDate"]
            is_expiry_day = dt >= expiry_date
            
            # Check days to expiry (DTE)
            days_left = max(0, (expiry_date - dt).days)
            T_years = days_left / 365.0
            
            # Compute current option values for each leg
            legs_pnl = 0
            current_premiums = []
            
            for leg in current_position["legs"]:
                strike = leg["strike"]
                option_type = leg["optionType"]
                qty = leg["quantity"]
                entry_premium = leg["entryPremium"]
                
                # Dynamic IV Skew Model
                dist_pct = (strike - spot_price) / spot_price
                leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
                leg_iv = max(0.05, min(1.0, leg_iv)) # cap between 5% and 100%
                
                # Price option using Black-Scholes
                if T_years <= 0:
                    # Intrinsic value at expiration
                    current_prem = max(0.0, spot_price - strike) if option_type == 'C' else max(0.0, strike - spot_price)
                else:
                    current_prem = bs_pricing(spot_price, strike, T_years, r, leg_iv, option_type)
                    
                current_premiums.append(current_prem)
                
                # Calculate P&L for this leg
                if leg["action"] == "BUY":
                    leg_return = current_prem - entry_premium
                else:
                    leg_return = entry_premium - current_prem
                    
                legs_pnl += leg_return * qty * lot_size
                
            current_position["maxProfitReached"] = max(current_position.get("maxProfitReached", 0.0), legs_pnl)
            
            # Calculate trailing stop loss level
            trailing_sl_level = None
            if req.trailingSL and req.trailingSLTrigger is not None and req.trailingSLStep is not None:
                max_profit_reached = current_position["maxProfitReached"]
                if max_profit_reached >= req.trailingSLTrigger:
                    base_sl = -current_position["activePortfolioSL"] if current_position["activePortfolioSL"] is not None else 0.0
                    steps = math.floor((max_profit_reached - req.trailingSLTrigger) / req.trailingSLStep)
                    trailing_sl_level = base_sl + steps * req.trailingSLStep
            
            # Check exit conditions
            exit_needed = False
            exit_reason = "Expiry"

            if is_expiry_day:
                exit_needed = True
                exit_reason = "Expiry"
            else:
                sl_val = current_position.get("activePortfolioSL")
                tp_val = current_position.get("activePortfolioTP")
                if sl_val is not None and legs_pnl <= -sl_val:
                    exit_needed = True
                    exit_reason = "Portfolio SL"
                elif tp_val is not None and legs_pnl >= tp_val:
                    exit_needed = True
                    exit_reason = "Portfolio TP"
                elif trailing_sl_level is not None and legs_pnl <= trailing_sl_level:
                    exit_needed = True
                    exit_reason = "Trailing SL"

            # Apply slippage on exit
            exit_slippage = sum(leg["quantity"] * req.slippagePerLeg for leg in current_position["legs"]) if exit_needed else 0.0
            net_pnl = legs_pnl - exit_slippage

            if exit_needed:
                # Close position
                capital += net_pnl
                current_position["exitDate"] = date_str
                current_position["exitSpot"] = spot_price
                current_position["exitPremiums"] = current_premiums
                current_position["netPnL"] = net_pnl
                current_position["exitReason"] = exit_reason
                trades_log.append(current_position)
                
                # Record monthly P&L
                year_month = dt.strftime("%Y-%m")
                monthly_pnl[year_month] = monthly_pnl.get(year_month, 0.0) + net_pnl
                
                current_position = None
            else:
                # Still open, net_pnl is unrealized
                net_pnl = legs_pnl
                
        # C. If no active position, check if we should enter a new position
        if current_position is None:
            # Check entry day criteria (e.g. Tuesday)
            if dt.weekday() in req.entryDaysOfWeek:
                expiry_dt = get_expiry_date(dt, symbol_upper, req.expiryType)
                days_to_expiry = max(1, (expiry_dt - dt).days)
                T_years = days_to_expiry / 365.0
                
                # Round spot price to nearest strike interval (ATM strike)
                atm_strike = round(spot_price / strike_round) * strike_round
                
                legs_data = []
                total_entry_cost = 0
                
                for leg_schema in req.legs:
                    strike = atm_strike + leg_schema.strikeOffset
                    
                    # Volatility skew calculation
                    dist_pct = (strike - spot_price) / spot_price
                    leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
                    leg_iv = max(0.05, min(1.0, leg_iv))
                    
                    # Calculate entry premium
                    entry_prem = bs_pricing(spot_price, strike, T_years, r, leg_iv, leg_schema.optionType)
                    
                    legs_data.append({
                        "action": leg_schema.action,
                        "optionType": leg_schema.optionType,
                        "strike": strike,
                        "quantity": leg_schema.quantity,
                        "entryPremium": entry_prem
                    })
                    
                    # Compute transaction entry cost/credit
                    # Slippage is paid on entry
                    if leg_schema.action == "BUY":
                        total_entry_cost += (entry_prem * lot_size + req.slippagePerLeg) * leg_schema.quantity
                    else:
                        total_entry_cost -= (entry_prem * lot_size - req.slippagePerLeg) * leg_schema.quantity
                        
                max_profit, max_loss = compute_strategy_max_profit_loss(legs_data, spot_price, lot_size)
                active_portfolio_tp = req.portfolioTakeProfit
                active_portfolio_sl = req.portfolioStopLoss

                if req.takeProfitPct is not None and max_profit != float('inf'):
                    pct_tp = max_profit * (req.takeProfitPct / 100.0)
                    if active_portfolio_tp is None or pct_tp < active_portfolio_tp:
                        active_portfolio_tp = pct_tp
                
                if req.stopLossPct is not None and max_loss != float('inf'):
                    pct_sl = max_loss * (req.stopLossPct / 100.0)
                    if active_portfolio_sl is None or pct_sl < active_portfolio_sl:
                        active_portfolio_sl = pct_sl

                current_position = {
                    "entryDate": date_str,
                    "entrySpot": spot_price,
                    "expiryDate": expiry_dt,
                    "legs": legs_data,
                    "entryCost": total_entry_cost,
                    "activePortfolioSL": active_portfolio_sl,
                    "activePortfolioTP": active_portfolio_tp,
                    "maxProfitReached": 0.0
                }
                
        # Record daily equity point
        running_equity = capital
        if current_position is not None:
            try:
                expiry_date = current_position["expiryDate"]
                days_left = max(0, (expiry_date - dt).days)
                T_years = days_left / 365.0
                legs_pnl = 0
                for leg in current_position["legs"]:
                    strike = leg["strike"]
                    option_type = leg["optionType"]
                    qty = leg["quantity"]
                    entry_premium = leg["entryPremium"]
                    
                    dist_pct = (strike - spot_price) / spot_price
                    leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
                    leg_iv = max(0.05, min(1.0, leg_iv))
                    
                    if T_years <= 0:
                        current_prem = max(0.0, spot_price - strike) if option_type == 'C' else max(0.0, strike - spot_price)
                    else:
                        current_prem = bs_pricing(spot_price, strike, T_years, r, leg_iv, option_type)
                        
                    if leg["action"] == "BUY":
                        legs_pnl += (current_prem - entry_premium) * qty * lot_size
                    else:
                        legs_pnl += (entry_premium - current_prem) * qty * lot_size
                running_equity += legs_pnl
            except Exception as e:
                print(f"[EOD Equity Curve] Error calculating daily unrealized PnL: {e}")
                
        equity_curve.append({
            "date": date_str,
            "equity": round(running_equity, 2),
            "spot": round(spot_price, 2)
        })

    # 3. Calculate Performance Metrics
    total_trades = len(trades_log)
    if total_trades > 0:
        winning_trades = [t for t in trades_log if t["netPnL"] > 0]
        losing_trades = [t for t in trades_log if t["netPnL"] <= 0]
        
        win_rate = (len(winning_trades) / total_trades) * 100.0
        
        total_profit = sum(t["netPnL"] for t in winning_trades)
        total_loss = abs(sum(t["netPnL"] for t in losing_trades))
        
        profit_factor = total_profit / total_loss if total_loss > 0 else float("inf")
        net_return = capital - req.initialCapital
        net_return_pct = (net_return / req.initialCapital) * 100.0
        
        # Drawdown calculation
        peak = req.initialCapital
        max_dd = 0.0
        for eq_point in equity_curve:
            val = eq_point["equity"]
            if val > peak:
                peak = val
            dd = (peak - val) / peak * 100.0
            if dd > max_dd:
                max_dd = dd
                
        # Sharpe ratio
        daily_returns = []
        for j in range(1, len(equity_curve)):
            ret = (equity_curve[j]["equity"] - equity_curve[j-1]["equity"]) / equity_curve[j-1]["equity"]
            daily_returns.append(ret)
        
        if len(daily_returns) > 0 and np.std(daily_returns) > 0:
            sharpe = (np.mean(daily_returns) / np.std(daily_returns)) * math.sqrt(252)
        else:
            sharpe = 0.0
    else:
        win_rate = 0.0
        profit_factor = 0.0
        net_return = 0.0
        net_return_pct = 0.0
        max_dd = 0.0
        sharpe = 0.0

    # 4. Formulate monthly grid response (group by year and month)
    monthly_grid = []
    years_seen = sorted(list(set(datetime.strptime(ym, "%Y-%m").year for ym in monthly_pnl.keys())))
    
    for yr in years_seen:
        row = {"year": yr}
        annual_total = 0.0
        for m in range(1, 13):
            key = f"{yr}-{m:02d}"
            val = monthly_pnl.get(key, 0.0)
            row[f"m{m}"] = round(val, 2)
            annual_total += val
        row["total"] = round(annual_total, 2)
        monthly_grid.append(row)

    return {
        "metrics": {
            "initialCapital": req.initialCapital,
            "finalCapital": round(capital, 2),
            "netPnL": round(net_return, 2),
            "netReturnPct": round(net_return_pct, 2),
            "winRate": round(win_rate, 2),
            "profitFactor": round(profit_factor, 2) if profit_factor != float("inf") else "Unlimited",
            "maxDrawdown": round(max_dd, 2),
            "sharpeRatio": round(sharpe, 2),
            "totalTrades": total_trades
        },
        "equityCurve": equity_curve,
        "monthlyGrid": monthly_grid,
        "trades": [
            {
                "entryDate": t["entryDate"],
                "entrySpot": round(t["entrySpot"], 2),
                "exitDate": t["exitDate"].strftime("%Y-%m-%d") if isinstance(t["exitDate"], datetime) else str(t["exitDate"]),
                "exitSpot": round(t["exitSpot"], 2),
                "exitReason": t.get("exitReason", "Expiry"),
                "netPnL": round(t["netPnL"], 2)
            }
            for t in trades_log
        ]
    }

@router.post("/optimize")
async def optimize_backtest(req: OptimizationRequest):
    if req.symbol.upper().endswith("1!"):
        req.symbol = req.symbol[:-2]
    symbol_upper = req.symbol.upper()
    lot_size = LOT_SIZES.get(symbol_upper, 100)
    strike_round = STRIKE_ROUND_INTERVALS.get(symbol_upper, 50)
    
    # 1. Populate search space defaults if ranges are not provided
    tp_range = req.takeProfitPctRange if req.takeProfitPctRange is not None else [None, 10.0, 20.0, 30.0, 50.0]
    sl_range = req.stopLossPctRange if req.stopLossPctRange is not None else [None, 10.0, 20.0, 30.0, 50.0]
    
    # Standard entry days combinations: Mon to Fri individual runs
    entry_days_combos = req.entryDaysRange if req.entryDaysRange is not None else [[0], [1], [2], [3], [4]]
    
    # Intraday specific ranges
    if req.backtestType.upper() == "INTRADAY":
        entry_time_range = req.entryTimeRange if req.entryTimeRange is not None else ["09:20", "09:45", "10:15"]
        exit_time_range = req.exitTimeRange if req.exitTimeRange is not None else ["15:15"]
    else:
        entry_time_range = ["15:30"]
        exit_time_range = ["15:30"]

    # 2. Fetch Historical Spot and VIX quotes ONCE
    spot_series = None
    vix_series = None
    dates_list = []
    
    day_candles = None
    sorted_days = []
    
    if req.backtestType.upper() == "INTRADAY":
        print(f"[Optimizer] Fetching historical intraday candles for {symbol_upper}...")
        try:
            # We default to 5-minute interval for optimization to balance speed/granularity
            raw_candles = market_service.get_historical_intraday_candles(
                symbol=symbol_upper,
                interval=5,
                from_date=req.startDate,
                to_date=req.endDate
            )
            if not raw_candles:
                raise HTTPException(
                    status_code=400,
                    detail=f"No intraday spot price data found for ticker {symbol_upper}. Note: Without Dhan API credentials, historical intraday backtests are limited to the past 30-60 days due to Yahoo Finance provider limits. Please shorten your date range (e.g. to the last 30 days) or switch to EOD mode for longer periods."
                )
                
            from collections import defaultdict
            day_candles = defaultdict(list)
            for c in raw_candles:
                date_str = c["timestamp"].split(" ")[0]
                day_candles[date_str].append(c)
            sorted_days = sorted(list(day_candles.keys()))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load intraday spot prices: {str(e)}")
    else:
        # EOD Mode
        spot_ticker = SPOT_TICKERS.get(symbol_upper, symbol_upper)
        print(f"[Optimizer] Fetching historical spot data for {spot_ticker}...")
        try:
            spot_df = yf.download(spot_ticker, start=req.startDate, end=req.endDate)
            if spot_df.empty:
                raise HTTPException(status_code=400, detail=f"No spot price data found for ticker {spot_ticker}")
            if isinstance(spot_df.columns, pd.MultiIndex):
                spot_df.columns = spot_df.columns.get_level_values(0)
            spot_series = spot_df["Close"].dropna()
            dates_list = spot_series.index.tolist()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to download spot prices: {str(e)}")

    # Fetch VIX series
    vix_ticker = VIX_TICKERS.get(symbol_upper, "^VIX")
    try:
        vix_df = yf.download(vix_ticker, start=req.startDate, end=req.endDate)
        if vix_df.empty:
            vix_series = pd.Series(15.0, index=pd.to_datetime(sorted_days if req.backtestType.upper() == "INTRADAY" else dates_list))
        else:
            if isinstance(vix_df.columns, pd.MultiIndex):
                vix_df.columns = vix_df.columns.get_level_values(0)
            vix_series = vix_df["Close"].dropna()
            if req.backtestType.upper() != "INTRADAY":
                vix_series = vix_series.reindex(spot_series.index, method="ffill").fillna(15.0)
    except Exception:
        vix_series = pd.Series(15.0, index=pd.to_datetime(sorted_days if req.backtestType.upper() == "INTRADAY" else dates_list))

    # 3. Permutation Loop
    results = []
    
    import itertools
    
    width_range = req.strikeWidthRange if req.strikeWidthRange is not None else [None]
    
    # Calculate base spacing of original legs to scale distance/spreads
    non_zero_offsets = [abs(leg.strikeOffset) for leg in req.legs if leg.strikeOffset != 0]
    base_spacing = min(non_zero_offsets) if non_zero_offsets else None
    
    def get_scaled_legs(strike_width: Optional[float]) -> list:
        if base_spacing is None or strike_width is None or base_spacing == 0:
            return req.legs
        factor = strike_width / base_spacing
        scaled = []
        for leg in req.legs:
            scaled.append(OptionLegSchema(
                action=leg.action,
                optionType=leg.optionType,
                strikeOffset=round(leg.strikeOffset * factor, 2),
                quantity=leg.quantity
            ))
        return scaled
    
    if req.backtestType.upper() == "INTRADAY":
        param_grid = itertools.product(
            tp_range,
            sl_range,
            entry_days_combos,
            entry_time_range,
            exit_time_range,
            width_range
        )
        
        for tp, sl, entry_days, entry_time, exit_time, strike_width in param_grid:
            entry_h, entry_m = map(int, entry_time.split(":"))
            exit_h, exit_m = map(int, exit_time.split(":"))
            
            scaled_legs = get_scaled_legs(strike_width)
            
            metrics = run_in_memory_intraday_backtest(
                sorted_days=sorted_days,
                day_candles=day_candles,
                vix_series=vix_series,
                legs=scaled_legs,
                entry_days=entry_days,
                entry_h=entry_h, entry_m=entry_m,
                exit_h=exit_h, exit_m=exit_m,
                slippage=req.slippagePerLeg,
                initial_capital=req.initialCapital,
                take_profit_pct=tp,
                stop_loss_pct=sl,
                lot_size=lot_size,
                strike_round=strike_round,
                expiry_type=req.expiryType,
                symbol=symbol_upper
            )
            
            results.append({
                "parameters": {
                    "takeProfitPct": tp,
                    "stopLossPct": sl,
                    "entryDays": entry_days,
                    "entryTime": entry_time,
                    "exitTime": exit_time,
                    "strikeWidth": strike_width
                },
                "metrics": metrics
            })
    else:
        param_grid = itertools.product(
            tp_range,
            sl_range,
            entry_days_combos,
            width_range
        )
        
        for tp, sl, entry_days, strike_width in param_grid:
            scaled_legs = get_scaled_legs(strike_width)
            
            metrics = run_in_memory_eod_backtest(
                dates_list=dates_list,
                spot_series=spot_series,
                vix_series=vix_series,
                legs=scaled_legs,
                entry_days=entry_days,
                slippage=req.slippagePerLeg,
                initial_capital=req.initialCapital,
                take_profit_pct=tp,
                stop_loss_pct=sl,
                lot_size=lot_size,
                strike_round=strike_round,
                expiry_type=req.expiryType,
                symbol=symbol_upper
            )
            
            results.append({
                "parameters": {
                    "takeProfitPct": tp,
                    "stopLossPct": sl,
                    "entryDays": entry_days,
                    "entryTime": None,
                    "exitTime": None,
                    "strikeWidth": strike_width
                },
                "metrics": metrics
            })

    # 4. Sort results by objective
    obj = req.objective
    def sort_key(item):
        val = item["metrics"].get(obj, 0.0)
        if val == "Unlimited":
            return float('inf')
        if obj == "maxDrawdown":
            return -val
        return val

    sorted_results = sorted(results, key=sort_key, reverse=True)
    
    return {
        "objective": obj,
        "resultsCount": len(sorted_results),
        "results": sorted_results
    }
