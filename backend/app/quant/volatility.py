import numpy as np
import pandas as pd
import math

def calculate_historical_volatility(prices: list, window: int = 30) -> float:
    """
    Calculates the annualized historical volatility of a price series over a specific window.
    prices: List of close prices.
    window: Rolling window size in days.
    """
    if len(prices) < window + 1:
        return 0.0
    
    # Calculate log returns
    log_returns = np.diff(np.log(prices))
    
    # Take the last 'window' log returns
    recent_returns = log_returns[-window:]
    
    # Calculate standard deviation and annualize (assuming 252 trading days)
    std_dev = np.std(recent_returns, ddof=1)
    ann_vol = std_dev * np.sqrt(252)
    
    return float(ann_vol)


def calculate_volatility_cone(prices: list) -> dict:
    """
    Calculates the volatility cone bounds (Min, 25th, Mean, 75th, Max) for windows of:
    10, 20, 30, 45, 60, 90 trading days.
    """
    if len(prices) < 120:
        # Return mock/empty structures if price series is too short
        return {}

    df = pd.DataFrame(prices, columns=['close'])
    df['log_return'] = np.log(df['close'] / df['close'].shift(1))
    
    windows = [10, 20, 30, 45, 60, 90]
    cone = {}

    for w in windows:
        # Calculate rolling standard deviation of log returns
        rolling_std = df['log_return'].rolling(window=w).std()
        rolling_vol = rolling_std * np.sqrt(252) * 100.0  # as percentage
        rolling_vol = rolling_vol.dropna()
        
        if len(rolling_vol) > 0:
            cone[str(w)] = {
                'window': w,
                'min': float(rolling_vol.min()),
                'p25': float(rolling_vol.quantile(0.25)),
                'mean': float(rolling_vol.mean()),
                'p75': float(rolling_vol.quantile(0.75)),
                'max': float(rolling_vol.max())
            }
            
    return cone
