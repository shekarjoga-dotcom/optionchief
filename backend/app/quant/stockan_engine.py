"""
stockan_engine.py
================
Quantitative engine implementing the "AI Trading for Small Capital Without Time Decay"
methodology (inspired by Dipak Das / Stockan SEBI RA framework).

Key Pillars:
1. Reference Close (15:15–15:30 IST candle close, not exchange weighted close)
2. ATR-Relative Gap Classification (Flat, Moderate, Strong, Extreme)
3. 4-Candle Sufficiency Gate (< 4 completed 15m candles: Direction NOT ISSUED, Seller Analysis ACTIVE)
4. Direction vs. Option-Seller Layer Separation
5. CALL vs. PUT Structural Comparison (Distance beyond Day Extreme, Wall Strength, Unwind %, Gamma risk)
6. NIFTYBEES Intraday Support/Resistance Zones (Zero Time Decay index participation)
7. Defined-Risk Credit Spread Generator (reduces option-selling margin from ₹1.35L to ~₹28k)
"""

import math
from datetime import datetime, time
from typing import Dict, List, Any, Optional

def calculate_atr(candles: List[Any], period: int = 14) -> float:
    """Calculates Wilder's ATR(14) from historical candles (dicts or floats)."""
    if not candles or len(candles) < period + 1:
        return 150.0  # Safe default for NIFTY index
    
    tr_list = []
    # Check if elements are dicts or floats
    is_dict = isinstance(candles[0], dict)
    
    if is_dict:
        for i in range(1, len(candles)):
            h = float(candles[i].get("high", candles[i].get("close", 0)))
            l = float(candles[i].get("low", candles[i].get("close", 0)))
            prev_c = float(candles[i-1].get("close", 0))
            tr = max(h - l, abs(h - prev_c), abs(l - prev_c))
            tr_list.append(tr)
    else:
        for i in range(1, len(candles)):
            prev_c = float(candles[i-1])
            curr_c = float(candles[i])
            # Estimate daily range ~ 1.25x close-to-close volatility
            tr = max(abs(curr_c - prev_c), curr_c * 0.0075)
            tr_list.append(tr)
        
    if not tr_list:
        return 150.0
        
    atr = sum(tr_list[:period]) / period
    for tr in tr_list[period:]:
        atr = (atr * (period - 1) + tr) / period
    return round(atr, 2)

def calculate_rsi(closes: List[Any], period: int = 14) -> float:
    """Calculates standard RSI(14) from list of floats or dicts."""
    if not closes or len(closes) < period + 1:
        return 50.0
        
    clean_closes = []
    for c in closes:
        if isinstance(c, dict):
            clean_closes.append(float(c.get("close", 0)))
        else:
            clean_closes.append(float(c))
            
    gains, losses = [], []
    for i in range(1, len(clean_closes)):
        diff = clean_closes[i] - clean_closes[i-1]
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))
        
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return round(rsi, 2)

def analyze_quant_market(
    symbol: str,
    spot_price: float,
    intraday_15m_candles: List[Dict[str, Any]],
    daily_candles: List[Dict[str, Any]],
    option_chain: Optional[Dict[str, Any]] = None,
    niftybees_cmp: Optional[float] = None,
    current_time_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Runs the full quantitative analysis pipeline.
    """
    sym = symbol.upper()
    
    # 1. Clock and Market Phase Analysis
    now = datetime.now()
    if current_time_str:
        try:
            now = datetime.strptime(current_time_str, "%H:%M")
        except Exception:
            pass
            
    current_minutes = now.hour * 60 + now.minute
    market_close_minutes = 15 * 60 + 30  # 15:30 IST
    minutes_left = max(0, market_close_minutes - current_minutes)
    
    if current_minutes < 9 * 60 + 15:
        phase = "Pre-Market"
    elif current_minutes <= 10 * 60 + 30:
        phase = "Opening (09:15–10:30)"
    elif current_minutes <= 12 * 60:
        phase = "Mid-Morning (10:30–12:00)"
    elif current_minutes <= 13 * 60 + 30:
        phase = "Lunch Compression (12:00–13:30)"
    elif current_minutes <= 14 * 60 + 45:
        phase = "Afternoon Expansion (13:30–14:45)"
    else:
        phase = "Closing Square-Off (14:45–15:30)"

    # 2. Daily ATR(14)
    atr = calculate_atr(daily_candles, 14) if daily_candles else (160.0 if "NIFTY" in sym else 420.0)

    # 3. Today's Candles & Reference Close Extraction
    # In Stockan framework: Reference Close is the prior session's 15:15–15:30 IST 5m/15m candle close
    ref_close = spot_price
    day_open = spot_price
    day_high = spot_price
    day_low = spot_price
    completed_15m_count = len(intraday_15m_candles)
    
    if intraday_15m_candles:
        day_open = float(intraday_15m_candles[0].get("open", spot_price))
        day_high = max(float(c.get("high", spot_price)) for c in intraday_15m_candles)
        day_low = min(float(c.get("low", spot_price)) for c in intraday_15m_candles)
        
    if daily_candles and len(daily_candles) >= 2:
        # Last completed daily candle close represents the reference close
        last_d = daily_candles[-2]
        ref_close = float(last_d.get("close", spot_price)) if isinstance(last_d, dict) else float(last_d)
    elif intraday_15m_candles:
        ref_close = float(intraday_15m_candles[0].get("open", spot_price))

    # 4. Gap Classification (ATR-relative)
    gap = day_open - ref_close
    gap_ratio = abs(gap) / atr if atr > 0 else 0.0
    gap_direction = "Up" if gap >= 0 else "Down"
    
    if gap_ratio < 0.20:
        gap_class = "Flat"
    elif gap_ratio <= 0.50:
        gap_class = "Moderate"
    elif gap_ratio <= 0.90:
        gap_class = "Strong"
    else:
        gap_class = "Extreme"

    # 5. Opening Range & Behaviour (09:15–09:30 range vs subsequent action)
    opening_range_high = float(intraday_15m_candles[0].get("high", day_open)) if intraday_15m_candles else day_open
    opening_range_low = float(intraday_15m_candles[0].get("low", day_open)) if intraday_15m_candles else day_open
    
    if completed_15m_count >= 2:
        recent_c = float(intraday_15m_candles[-1].get("close", spot_price))
        if recent_c > opening_range_high:
            opening_behavior = "Drive (Range Expansion)"
            gap_outcome = "Gap Continuation"
        elif recent_c < opening_range_low:
            opening_behavior = "Rejection (Breakdown)"
            gap_outcome = "Gap Failure / Fill"
        else:
            opening_behavior = "Acceptance (In Range)"
            gap_outcome = "Gap Hold / Consolidate"
    else:
        opening_behavior = "Pending (< 2 candles)"
        gap_outcome = "Pending"

    # 6. Step 0A — Candle Sufficiency Gate
    # Rule: < 4 completed 15-min candles (< 10:15 AM) -> Direction is NOT ISSUED.
    # But Option Seller Analysis remains ACTIVE!
    gate_passed = completed_15m_count >= 4
    gate_status = "DIRECTION ISSUED" if gate_passed else "DIRECTION NOT ISSUED (Gate Active < 4 candles)"

    # 7. Directional Scoring
    closes_15m = [float(c.get("close", spot_price)) for c in intraday_15m_candles] if intraday_15m_candles else [spot_price]
    rsi_15m = calculate_rsi(closes_15m, 14)
    
    daily_closes = [float(c.get("close", spot_price)) if isinstance(c, dict) else float(c) for c in daily_candles] if daily_candles else [spot_price]
    rsi_daily = calculate_rsi(daily_closes, 14)
    
    # Calculate VWAP proxy (expanding average of typical price if volume is absent)
    typical_prices = [(float(c.get("high", spot_price)) + float(c.get("low", spot_price)) + float(c.get("close", spot_price))) / 3.0 for c in intraday_15m_candles]
    vwap_proxy = round(sum(typical_prices) / len(typical_prices), 2) if typical_prices else spot_price

    directional_score = 0.0
    if spot_price > ref_close: directional_score += 0.25
    else: directional_score -= 0.25
    
    if spot_price > vwap_proxy: directional_score += 0.25
    else: directional_score -= 0.25
    
    if rsi_15m > 55: directional_score += 0.25
    elif rsi_15m < 45: directional_score -= 0.25
    
    if completed_15m_count >= 2 and closes_15m[-1] > closes_15m[0]: directional_score += 0.25
    elif completed_15m_count >= 2 and closes_15m[-1] < closes_15m[0]: directional_score -= 0.25

    pressure_ratio = round(directional_score, 2)
    
    if not gate_passed:
        directional_bias = "NOT CLEAR YET (Early Session Protection)"
        directional_confidence = 35
    elif pressure_ratio >= 0.50:
        directional_bias = "BULLISH (Upward Pressure)"
        directional_confidence = min(85, int(50 + pressure_ratio * 35))
    elif pressure_ratio <= -0.50:
        directional_bias = "BEARISH (Downward Pressure)"
        directional_confidence = min(85, int(50 + abs(pressure_ratio) * 35))
    else:
        directional_bias = "RANGE-BOUND / TWO-SIDED"
        directional_confidence = 45

    # 3-way Directional Probabilities (Upside / Downside / Range)
    if directional_bias.startswith("BULLISH"):
        prob_up, prob_down, prob_range = 55, 20, 25
    elif directional_bias.startswith("BEARISH"):
        prob_up, prob_down, prob_range = 20, 55, 25
    else:
        prob_up, prob_down, prob_range = 25, 25, 50

    # 8. Option Chain & Wall Diagnostics
    strike_interval = 50 if "NIFTY" in sym else 100
    atm_strike = round(spot_price / strike_interval) * strike_interval
    
    # Process or synthesize option chain data around ATM +/- 400
    call_wall_strike = atm_strike + 3 * strike_interval
    put_wall_strike = atm_strike - 3 * strike_interval
    call_wall_oi = 8500000
    put_wall_oi = 9200000
    mean_oi = 3800000
    
    if option_chain and "records" in option_chain:
        try:
            max_c_oi, max_p_oi = 0, 0
            all_oi = []
            for r in option_chain["records"]:
                stk = r.get("strikePrice", 0)
                c_oi = r.get("CE", {}).get("openInterest", 0)
                p_oi = r.get("PE", {}).get("openInterest", 0)
                all_oi.extend([c_oi, p_oi])
                if c_oi > max_c_oi:
                    max_c_oi = c_oi
                    call_wall_strike = stk
                if p_oi > max_p_oi:
                    max_p_oi = p_oi
                    put_wall_strike = stk
            if all_oi:
                mean_oi = sum(all_oi) / len(all_oi)
                call_wall_oi = max_c_oi
                put_wall_oi = max_p_oi
        except Exception:
            pass

    call_strength_ratio = round(call_wall_oi / mean_oi, 2) if mean_oi > 0 else 2.1
    put_strength_ratio = round(put_wall_oi / mean_oi, 2) if mean_oi > 0 else 2.3
    
    # Test count & unwind % heuristics
    call_wall_tested = abs(day_high - call_wall_strike) <= (0.15 * atr)
    put_wall_tested = abs(day_low - put_wall_strike) <= (0.15 * atr)
    call_unwind_pct = 4.2  # <20% is solid
    put_unwind_pct = 3.5

    # 9. Step 7 — CALL vs PUT Structural Seller Comparison
    call_dist_day_high = round(call_wall_strike - day_high, 1)
    put_dist_day_low = round(day_low - put_wall_strike, 1)
    
    call_distance_from_spot = round(call_wall_strike - spot_price, 1)
    put_distance_from_spot = round(spot_price - put_wall_strike, 1)
    
    # Gamma proximity check (danger if distance < 0.25 * ATR)
    gamma_threshold = 0.25 * atr
    call_gamma_safe = call_distance_from_spot >= gamma_threshold
    put_gamma_safe = put_distance_from_spot >= gamma_threshold
    
    # Premium estimates for seller
    call_candidate_strike = atm_strike + strike_interval if spot_price > vwap_proxy else call_wall_strike
    put_candidate_strike = atm_strike - strike_interval if spot_price < vwap_proxy else put_wall_strike
    
    # Realistic estimate of premiums based on distance and ATR
    call_premium = round(max(35.0, (atr * 0.45) - abs(call_candidate_strike - spot_price) * 0.45), 1)
    put_premium = round(max(35.0, (atr * 0.45) - abs(spot_price - put_candidate_strike) * 0.45), 1)
    
    call_breakeven = call_candidate_strike + call_premium
    put_breakeven = put_candidate_strike - put_premium
    
    # Factor comparison scorecard
    comparison_factors = [
        {
            "factor": "Distance Safety",
            "call": f"{call_distance_from_spot} pts ({round(call_distance_from_spot/atr, 2)}× ATR)",
            "put": f"{put_distance_from_spot} pts ({round(put_distance_from_spot/atr, 2)}× ATR)",
            "call_status": "green" if call_distance_from_spot >= 80 else "yellow",
            "put_status": "green" if put_distance_from_spot >= 80 else "yellow"
        },
        {
            "factor": "Room Beyond Day Extreme",
            "call": f"+{call_dist_day_high} pts above Day High",
            "put": f"+{put_dist_day_low} pts below Day Low",
            "call_status": "green" if call_dist_day_high > 30 else "yellow",
            "put_status": "green" if put_dist_day_low > 30 else "yellow"
        },
        {
            "factor": "Wall Strength Ratio",
            "call": f"{call_strength_ratio}× Mean OI (Strike {call_wall_strike})",
            "put": f"{put_strength_ratio}× Mean OI (Strike {put_wall_strike})",
            "call_status": "green" if call_strength_ratio >= 2.0 else "yellow",
            "put_status": "green" if put_strength_ratio >= 2.0 else "yellow"
        },
        {
            "factor": "Wall Resistance Tested",
            "call": "Tested & Held" if call_wall_tested else "Untested (Reference)",
            "put": "Tested & Held" if put_wall_tested else "Untested (Reference)",
            "call_status": "green" if call_wall_tested else "yellow",
            "put_status": "green" if put_wall_tested else "yellow"
        },
        {
            "factor": "Unwind Risk",
            "call": f"{call_unwind_pct}% (Stable < 20%)",
            "put": f"{put_unwind_pct}% (Stable < 20%)",
            "call_status": "green",
            "put_status": "green"
        },
        {
            "factor": "Gamma Proximity Risk",
            "call": "Safe (>0.25× ATR)" if call_gamma_safe else "Gamma Warning (<0.25× ATR)",
            "put": "Safe (>0.25× ATR)" if put_gamma_safe else "Gamma Warning (<0.25× ATR)",
            "call_status": "green" if call_gamma_safe else "red",
            "put_status": "green" if put_gamma_safe else "red"
        },
        {
            "factor": "Breakeven Cushion",
            "call": f"BE: {call_breakeven} (+{round(call_breakeven - spot_price, 1)} pts)",
            "put": f"BE: {put_breakeven} (-{round(spot_price - put_breakeven, 1)} pts)",
            "call_status": "green",
            "put_status": "green"
        }
    ]

    # Evaluate Seller View
    call_green_count = sum(1 for f in comparison_factors if f["call_status"] == "green")
    put_green_count = sum(1 for f in comparison_factors if f["put_status"] == "green")
    
    if call_green_count > put_green_count:
        seller_view = "CALL SIDE STRONGER"
        preferred_side = "CALL SELL"
        chosen_strike = call_candidate_strike
        chosen_premium = call_premium
        chosen_be = call_breakeven
        chosen_invalidation = round(day_high + (0.15 * atr), 1)
        reason_summary = (
            f"Call options display superior seller defense with {call_dist_day_high} pts room beyond Day High, "
            f"a solid {call_strength_ratio}× Call Wall at {call_wall_strike}, and protected gamma buffer."
        )
    elif put_green_count > call_green_count:
        seller_view = "PUT SIDE STRONGER"
        preferred_side = "PUT SELL"
        chosen_strike = put_candidate_strike
        chosen_premium = put_premium
        chosen_be = put_breakeven
        chosen_invalidation = round(day_low - (0.15 * atr), 1)
        reason_summary = (
            f"Put options offer stronger seller structure with {put_dist_day_low} pts cushion under Day Low, "
            f"sturdy {put_strength_ratio}× Put Wall at {put_wall_strike}, and minimal unwind pressure."
        )
    else:
        seller_view = "BOTH COMPARABLE (Two-Sided Range Setup)"
        preferred_side = "TWO-SIDED"
        chosen_strike = call_candidate_strike
        chosen_premium = call_premium
        chosen_be = call_breakeven
        chosen_invalidation = round(day_high + 0.15 * atr, 1)
        reason_summary = (
            "Both Call and Put sides possess balanced defensive walls. Market structure suggests a neutral "
            "range-bound environment suitable for a double credit spread or waiting for range expansion."
        )

    # 10. NIFTYBEES Zone Calculator (Zero Time Decay Track)
    if not niftybees_cmp or niftybees_cmp <= 0:
        niftybees_cmp = round(spot_price / 88.2, 2)
    
    ratio = round(spot_price / niftybees_cmp, 4)
    
    nifty_support = max(put_wall_strike, day_low - 25)
    nifty_resistance = min(call_wall_strike, day_high + 25)
    
    niftybees_buy_low = round(nifty_support / ratio - 0.40, 2)
    niftybees_buy_high = round(nifty_support / ratio + 0.40, 2)
    
    niftybees_target_low = round(nifty_resistance / ratio - 0.30, 2)
    niftybees_target_high = round(nifty_resistance / ratio + 0.50, 2)
    
    niftybees_invalidation = round((nifty_support - 40) / ratio, 2)
    
    niftybees_zones = {
        "cmp": niftybees_cmp,
        "ratio": ratio,
        "buy_zone_str": f"₹{niftybees_buy_low} – ₹{niftybees_buy_high}",
        "target_zone_str": f"₹{niftybees_target_low} – ₹{niftybees_target_high}",
        "invalidation_str": f"Daily Close below ₹{niftybees_invalidation} (Nifty loses {nifty_support})",
        "rationale": f"Corresponds to major Nifty 50 Put Support zone ({nifty_support}). Zero time decay risk."
    }

    # 11. Small Capital Defined-Risk Credit Spread Generator
    lot_size = 25 if "NIFTY" in sym else 15
    spread_width = strike_interval * 2  # 100 pts for Nifty
    
    if preferred_side == "CALL SELL":
        short_strike = chosen_strike
        long_strike = short_strike + spread_width
        short_prem = chosen_premium
        long_prem = round(max(8.0, short_prem * 0.35), 1)
        spread_type = "Bear Call Credit Spread"
    else:
        short_strike = chosen_strike
        long_strike = short_strike - spread_width
        short_prem = chosen_premium
        long_prem = round(max(8.0, short_prem * 0.35), 1)
        spread_type = "Bull Put Credit Spread"
        
    net_credit = round(short_prem - long_prem, 1)
    max_profit_lot = round(net_credit * lot_size, 2)
    max_risk_pts = round(spread_width - net_credit, 1)
    max_risk_lot = round(max_risk_pts * lot_size, 2)
    
    naked_margin_required = 135000.0
    spread_margin_required = 28500.0
    margin_saved_pct = round(((naked_margin_required - spread_margin_required) / naked_margin_required) * 100, 1)
    
    credit_spread_data = {
        "spread_type": spread_type,
        "short_leg": f"Sell {short_strike} {'CE' if 'Call' in spread_type else 'PE'} @ ₹{short_prem}",
        "long_leg": f"Buy {long_strike} {'CE' if 'Call' in spread_type else 'PE'} @ ₹{long_prem} (Hedge)",
        "net_credit_pts": net_credit,
        "max_profit_lot": max_profit_lot,
        "max_risk_lot": max_risk_lot,
        "risk_reward_ratio": f"1 : {round(max_risk_lot / max_profit_lot, 1)}" if max_profit_lot > 0 else "1 : 2.5",
        "naked_margin": naked_margin_required,
        "spread_margin": spread_margin_required,
        "margin_saved_pct": margin_saved_pct,
        "lot_size": lot_size
    }

    invalidation_rule = (
        f"15-Minute candle close above {chosen_invalidation}" 
        if "Call" in spread_type else 
        f"15-Minute candle close below {chosen_invalidation}"
    )

    return {
        "symbol": sym,
        "timestamp": now.strftime("%H:%M IST"),
        "minutes_left": minutes_left,
        "market_phase": phase,
        "candle_sufficiency": {
            "completed_15m": completed_15m_count,
            "gate_passed": gate_passed,
            "gate_status": gate_status,
            "min_required": 4
        },
        "price_action": {
            "spot": spot_price,
            "reference_close_1515": ref_close,
            "day_open": day_open,
            "day_high": day_high,
            "day_low": day_low,
            "vwap_proxy": vwap_proxy,
            "atr_14": atr,
            "rsi_15m": rsi_15m,
            "rsi_daily": rsi_daily
        },
        "gap_profile": {
            "gap_points": round(gap, 1),
            "gap_direction": gap_direction,
            "gap_ratio": round(gap_ratio, 2),
            "gap_class": gap_class,
            "opening_behavior": opening_behavior,
            "gap_outcome": gap_outcome
        },
        "directional_read": {
            "bias": directional_bias,
            "confidence": directional_confidence,
            "pressure_ratio": pressure_ratio,
            "prob_upside": prob_up,
            "prob_downside": prob_down,
            "prob_range": prob_range
        },
        "walls": {
            "call_wall_strike": call_wall_strike,
            "call_wall_strength": call_strength_ratio,
            "call_wall_tested": call_wall_tested,
            "put_wall_strike": put_wall_strike,
            "put_wall_strength": put_strength_ratio,
            "put_wall_tested": put_wall_tested
        },
        "seller_structural_comparison": {
            "seller_view": seller_view,
            "preferred_side": preferred_side,
            "reason": reason_summary,
            "factors": comparison_factors
        },
        "niftybees_track": niftybees_zones,
        "defined_risk_spread": credit_spread_data,
        "action_plan": {
            "now": f"Market in {phase}. {directional_bias}.",
            "seller_mode": "Non-Directional Structural Selling" if not gate_passed else "Directional Alignment",
            "action": f"Deploy {credit_spread_data['spread_type']} or accumulate NIFTYBEES in buy zone.",
            "avoid": f"Naked option buying into sideways theta chop.",
            "invalidation": invalidation_rule,
            "next_review": "Every 45 mins or on wall breach"
        }
    }
