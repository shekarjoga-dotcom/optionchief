import numpy as np
from scipy.stats import norm
import math

def bs_pricing(S, K, T, r, sigma, option_type='C', q=0.0):
    """
    S: Spot Price
    K: Strike Price
    T: Time to expiry in years
    r: Risk-free rate (annualized, decimal)
    sigma: Volatility (annualized, decimal)
    option_type: 'C' for Call, 'P' for Put
    q: Dividend yield (annualized, decimal)
    """
    if T <= 0:
        if option_type.upper() == 'C':
            return max(0.0, S - K)
        else:
            return max(0.0, K - S)
            
    if sigma <= 0:
        if option_type.upper() == 'C':
            return max(0.0, S * math.exp(-q * T) - K * math.exp(-r * T))
        else:
            return max(0.0, K * math.exp(-r * T) - S * math.exp(-q * T))

    d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    if option_type.upper() == 'C':
        price = S * math.exp(-q * T) * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    else:
        price = K * math.exp(-r * T) * norm.cdf(-d2) - S * math.exp(-q * T) * norm.cdf(-d1)

    return max(0.0, price)


def bs_greeks(S, K, T, r, sigma, option_type='C', q=0.0):
    """
    Returns a dictionary of Delta, Gamma, Vega, Theta, Rho.
    Vega is returned for a 1% change in volatility (value / 100).
    Theta is returned for 1 day change (value / 365).
    """
    # Safeguard for zero or negative time/volatility
    if T <= 0:
        if option_type.upper() == 'C':
            delta = 1.0 if S > K else 0.0
            theta = 0.0
        else:
            delta = -1.0 if K > S else 0.0
            theta = 0.0
        return {
            'price': max(0.0, S - K if option_type.upper() == 'C' else K - S),
            'delta': delta,
            'gamma': 0.0,
            'vega': 0.0,
            'theta': theta,
            'rho': 0.0
        }

    if sigma <= 0:
        sigma = 1e-5

    d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    pdf_d1 = norm.pdf(d1)
    cdf_d1 = norm.cdf(d1)
    cdf_d2 = norm.cdf(d2)
    cdf_minus_d1 = norm.cdf(-d1)
    cdf_minus_d2 = norm.cdf(-d2)

    price = bs_pricing(S, K, T, r, sigma, option_type, q)

    if option_type.upper() == 'C':
        delta = math.exp(-q * T) * cdf_d1
        rho = K * T * math.exp(-r * T) * cdf_d2
        # Theta for Call
        term1 = -(S * math.exp(-q * T) * pdf_d1 * sigma) / (2 * math.sqrt(T))
        term2 = -r * K * math.exp(-r * T) * cdf_d2
        term3 = q * S * math.exp(-q * T) * cdf_d1
        theta = term1 + term2 + term3
    else:
        delta = -math.exp(-q * T) * cdf_minus_d1
        rho = -K * T * math.exp(-r * T) * cdf_minus_d2
        # Theta for Put
        term1 = -(S * math.exp(-q * T) * pdf_d1 * sigma) / (2 * math.sqrt(T))
        term2 = r * K * math.exp(-r * T) * cdf_minus_d2
        term3 = -q * S * math.exp(-q * T) * cdf_minus_d1
        theta = term1 + term2 + term3

    gamma = math.exp(-q * T) * pdf_d1 / (S * sigma * math.sqrt(T))
    vega = S * math.exp(-q * T) * pdf_d1 * math.sqrt(T)

    return {
        'price': price,
        'delta': delta,
        'gamma': gamma,
        'vega': vega / 100.0,       # Per 1% IV change
        'theta': theta / 365.0,     # Per calendar day
        'rho': rho / 100.0          # Per 1% rate change
    }


def bs_implied_volatility(market_price, S, K, T, r, option_type='C', q=0.0):
    """
    Finds implied volatility using Newton-Raphson method with a Bisection fallback.
    Returns None if IV cannot be found.
    """
    if T <= 0:
        return 0.0

    # Minimum intrinsic value check
    intrinsic_val = S - K if option_type.upper() == 'C' else K - S
    intrinsic_val = max(0.0, intrinsic_val * math.exp(-r * T))
    if market_price <= intrinsic_val:
        return 0.0

    # Newton-Raphson parameters
    sigma = 0.5  # initial guess (50% IV)
    max_iter = 100
    tolerance = 1e-6

    for i in range(max_iter):
        price = bs_pricing(S, K, T, r, sigma, option_type, q)
        diff = price - market_price
        
        if abs(diff) < tolerance:
            return sigma

        # Vega calculation for derivative
        d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        vega = S * math.exp(-q * T) * norm.pdf(d1) * math.sqrt(T)

        if vega > 1e-4:
            sigma_new = sigma - diff / vega
            # If Newton step goes out of bounds, break to bisection fallback
            if sigma_new <= 0 or sigma_new > 10.0:
                break
            sigma = sigma_new
        else:
            break
    else:
        # If successfully solved inside Newton
        if 0 < sigma < 10.0:
            return sigma

    # Bisection Fallback
    low_sigma = 1e-5
    high_sigma = 5.0
    
    # Check bounds
    price_low = bs_pricing(S, K, T, r, low_sigma, option_type, q)
    price_high = bs_pricing(S, K, T, r, high_sigma, option_type, q)
    
    if market_price < price_low:
        return 0.0
    if market_price > price_high:
        return high_sigma

    for _ in range(100):
        mid_sigma = (low_sigma + high_sigma) / 2.0
        price_mid = bs_pricing(S, K, T, r, mid_sigma, option_type, q)
        diff = price_mid - market_price

        if abs(diff) < tolerance:
            return mid_sigma
        
        if diff > 0:
            high_sigma = mid_sigma
        else:
            low_sigma = mid_sigma

    return (low_sigma + high_sigma) / 2.0


def calculate_pop(S: float, break_evens: list, T: float, r: float, sigma: float) -> float:
    """
    Calculates log-normal probability of profit (POP) based on break-evens.
    """
    if T <= 0 or sigma <= 0:
        return 0.50

    be = sorted(break_evens)
    
    def get_d2(K):
        try:
            d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
            return d1 - sigma * math.sqrt(T)
        except Exception:
            return 0.0

    if len(be) == 0:
        return 0.50

    if len(be) == 1:
        d2 = get_d2(be[0])
        # Bullish/bearish heuristic: if spot > BE, assume profit is above BE
        if S > be[0]:
            return float(norm.cdf(d2))
        else:
            return float(norm.cdf(-d2))

    # Multi-leg boundaries (lower and upper)
    d2_lower = get_d2(be[0])
    d2_upper = get_d2(be[-1])  # use outer-most boundaries
    pop = norm.cdf(d2_upper) - norm.cdf(d2_lower)
    return float(max(0.0, min(1.0, pop)))

