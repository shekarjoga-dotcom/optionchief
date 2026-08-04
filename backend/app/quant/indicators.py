import numpy as np

def calculate_rsi(closes: list, period: int = 14) -> list:
    """
    Computes Wilder's Relative Strength Index (RSI).
    """
    n = len(closes)
    if n <= period:
        return [50.0] * n
        
    rsi = [50.0] * n
    
    # Calculate differences
    deltas = np.diff(closes)
    
    # Calculate first average gain and loss
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    if avg_loss == 0:
        rsi[period] = 100.0 if avg_gain > 0 else 50.0
    else:
        rs = avg_gain / avg_loss
        rsi[period] = 100.0 - (100.0 / (1.0 + rs))
        
    for i in range(period + 1, n):
        gain = gains[i - 1]
        loss = losses[i - 1]
        
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        
        if avg_loss == 0:
            rsi[i] = 100.0 if avg_gain > 0 else 50.0
        else:
            rs = avg_gain / avg_loss
            rsi[i] = 100.0 - (100.0 / (1.0 + rs))
            
    return rsi

def calculate_ema(prices: list, period: int) -> list:
    """
    Computes Exponential Moving Average (EMA).
    """
    n = len(prices)
    if n < period:
        return prices.copy()
        
    ema = [0.0] * n
    # Initial SMA
    sma = sum(prices[:period]) / period
    ema[period - 1] = sma
    
    multiplier = 2.0 / (period + 1.0)
    for i in range(period, n):
        ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1]
        
    # Fill pre-period values with SMA fallback
    for i in range(period - 1):
        ema[i] = sma
        
    return ema

def detect_price_action_signals(candles: list, rsi_period: int = 3, rsi_upper: float = 80.0, rsi_lower: float = 20.0) -> list:
    """
    Detects intraday RSI + Price Action breakouts.
    Inputs:
        candles: list of dicts with keys 'timestamp', 'open', 'high', 'low', 'close', 'volume'
        rsi_period: period for RSI calculation
        rsi_upper: upper threshold for bullish momentum
        rsi_lower: lower threshold for bearish momentum
    Returns:
        signals: list of dicts representing triggered signals:
            {
                'timestamp': str,
                'direction': 'BULLISH_CE', 'BEARISH_PE',
                'spot_price': float,
                'rsi_value': float,
                'signal_candle': dict
            }
    """
    n = len(candles)
    if n < rsi_period + 2:
        return []
        
    closes = [c['close'] for c in candles]
    rsi_vals = calculate_rsi(closes, rsi_period)
    
    # Store RSI values inside candles for charting/debugging
    for idx, c in enumerate(candles):
        c['rsi'] = rsi_vals[idx]
        
    signals = []
    
    # Track pending setups
    # CE Setup: waiting for price to break ABOVE the high of the signal candle
    pending_ce = None
    pending_pe = None
    
    # Max candle count to wait for a breakout (e.g. 3 candles)
    max_wait_candles = 3
    
    for i in range(rsi_period + 1, n):
        curr_candle = candles[i]
        prev_candle = candles[i - 1]
        prev_rsi = rsi_vals[i - 1]
        
        # 1. Check for CE setup (RSI crossed above rsi_upper on prev_candle)
        if prev_rsi >= rsi_upper and (rsi_vals[i - 2] < rsi_upper or rsi_vals[i - 2] is None):
            pending_ce = {
                'high': prev_candle['high'],
                'low': prev_candle['low'],
                'timestamp': prev_candle['timestamp'],
                'rsi': prev_rsi,
                'index': i - 1,
                'candle': prev_candle
            }
            pending_pe = None # Invalidate opposite setup
            
        # 2. Check for PE setup (RSI crossed below rsi_lower on prev_candle)
        if prev_rsi <= rsi_lower and (rsi_vals[i - 2] > rsi_lower or rsi_vals[i - 2] is None):
            pending_pe = {
                'high': prev_candle['high'],
                'low': prev_candle['low'],
                'timestamp': prev_candle['timestamp'],
                'rsi': prev_rsi,
                'index': i - 1,
                'candle': prev_candle
            }
            pending_ce = None # Invalidate opposite setup
            
        # 3. Evaluate pending CE breakout
        if pending_ce:
            # Check if expired
            if (i - pending_ce['index']) > max_wait_candles:
                pending_ce = None
            # Check if invalidated (closed below low of signal candle)
            elif curr_candle['close'] < pending_ce['low']:
                pending_ce = None
            # Check if breakout occurred in the current candle
            elif curr_candle['high'] > pending_ce['high']:
                # Trigger signal! Entry price is the high of the signal candle
                trigger_price = max(curr_candle['open'], pending_ce['high'])
                signals.append({
                    'timestamp': curr_candle['timestamp'],
                    'direction': 'BULLISH_CE',
                    'spot_price': trigger_price,
                    'rsi_value': pending_ce['rsi'],
                    'signal_candle': pending_ce['candle']
                })
                pending_ce = None # Reset after trigger
                
        # 4. Evaluate pending PE breakdown
        if pending_pe:
            # Check if expired
            if (i - pending_pe['index']) > max_wait_candles:
                pending_pe = None
            # Check if invalidated (closed above high of signal candle)
            elif curr_candle['close'] > pending_pe['high']:
                pending_pe = None
            # Check if breakdown occurred in the current candle
            elif curr_candle['low'] < pending_pe['low']:
                # Trigger signal! Entry price is the low of the signal candle
                trigger_price = min(curr_candle['open'], pending_pe['low'])
                signals.append({
                    'timestamp': curr_candle['timestamp'],
                    'direction': 'BEARISH_PE',
                    'spot_price': trigger_price,
                    'rsi_value': pending_pe['rsi'],
                    'signal_candle': pending_pe['candle']
                })
                pending_pe = None # Reset after trigger
                
    return signals
