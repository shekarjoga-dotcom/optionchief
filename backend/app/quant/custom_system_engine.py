import re
import ast
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

# ==========================================
# 1. TECHNICAL INDICATORS LIBRARY
# ==========================================

def calc_rsi(closes: np.ndarray, period: int = 14) -> np.ndarray:
    n = len(closes)
    if n <= period:
        return np.full(n, 50.0)
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    
    rsi = np.full(n, 50.0)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])
    
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

def calc_ema(values: np.ndarray, period: int) -> np.ndarray:
    n = len(values)
    if n < period:
        return values.copy()
    ema = np.zeros(n)
    sma = np.mean(values[:period])
    ema[period - 1] = sma
    mult = 2.0 / (period + 1.0)
    for i in range(period, n):
        ema[i] = (values[i] - ema[i - 1]) * mult + ema[i - 1]
    for i in range(period - 1):
        ema[i] = sma
    return ema

def calc_sma(values: np.ndarray, period: int) -> np.ndarray:
    s = pd.Series(values)
    return s.rolling(window=period, min_periods=1).mean().to_numpy()

def calc_vwap(df: pd.DataFrame) -> np.ndarray:
    # Intraday VWAP reset daily
    df_copy = df.copy()
    if 'timestamp' in df_copy.columns:
        df_copy['date'] = pd.to_datetime(df_copy['timestamp']).dt.date
    else:
        df_copy['date'] = 1
    
    typical_price = (df_copy['high'] + df_copy['low'] + df_copy['close']) / 3.0
    vol = df_copy['volume'].replace(0, 1)
    df_copy['pv'] = typical_price * vol
    
    cum_pv = df_copy.groupby('date')['pv'].cumsum()
    cum_vol = df_copy.groupby('date')['volume'].cumsum().replace(0, 1)
    vwap = cum_pv / cum_vol
    return vwap.to_numpy()

def calc_atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 14) -> np.ndarray:
    n = len(close)
    if n < 2:
        return np.zeros(n)
    tr = np.zeros(n)
    tr[0] = high[0] - low[0]
    for i in range(1, n):
        tr[i] = max(
            high[i] - low[i],
            abs(high[i] - close[i - 1]),
            abs(low[i] - close[i - 1])
        )
    return calc_ema(tr, period)

def calc_supertrend(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 10, multiplier: float = 3.0) -> Tuple[np.ndarray, np.ndarray]:
    n = len(close)
    atr = calc_atr(high, low, close, period)
    hl2 = (high + low) / 2.0
    upperband = hl2 + (multiplier * atr)
    lowerband = hl2 - (multiplier * atr)
    
    supertrend = np.zeros(n)
    direction = np.ones(n)  # 1 = Bullish (green), -1 = Bearish (red)
    
    for i in range(1, n):
        if close[i - 1] > lowerband[i - 1]:
            lowerband[i] = max(lowerband[i], lowerband[i - 1])
        if close[i - 1] < upperband[i - 1]:
            upperband[i] = min(upperband[i], upperband[i - 1])
            
        if close[i] > upperband[i - 1]:
            direction[i] = 1
        elif close[i] < lowerband[i - 1]:
            direction[i] = -1
        else:
            direction[i] = direction[i - 1]
            if direction[i] == 1 and lowerband[i] < lowerband[i - 1]:
                lowerband[i] = lowerband[i - 1]
            if direction[i] == -1 and upperband[i] > upperband[i - 1]:
                upperband[i] = upperband[i - 1]
                
        supertrend[i] = lowerband[i] if direction[i] == 1 else upperband[i]
        
    return supertrend, direction

def calc_macd(close: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    ema_fast = calc_ema(close, fast)
    ema_slow = calc_ema(close, slow)
    macd_line = ema_fast - ema_slow
    signal_line = calc_ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def calc_bollinger_bands(close: np.ndarray, period: int = 20, std_dev: float = 2.0) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    s = pd.Series(close)
    mid = s.rolling(window=period, min_periods=1).mean().to_numpy()
    std = s.rolling(window=period, min_periods=1).std().fillna(0).to_numpy()
    upper = mid + (std_dev * std)
    lower = mid - (std_dev * std)
    return upper, mid, lower


# ==========================================
# 2. CHARTINK / CUSTOM SCRIPT PARSER
# ==========================================

class CustomRuleParser:
    """
    Parses and safely executes Chartink-like trading system rules.
    Supports clauses like:
      - Close > EMA(20) and RSI(14) > 60
      - [0] Close > [0] EMA(20)
      - RSI(14) crosses above 50
      - Close > High[-1]
      - Volume > SMA(Volume, 20) * 1.5
      - Supertrend(10, 3) == 1
    """

    @staticmethod
    def extract_indicators_and_params(code: str) -> List[Dict[str, Any]]:
        found = []
        code_upper = code.upper()

        for m in re.finditer(r"RSI\s*\(\s*(\d+)\s*\)", code_upper):
            found.append({"type": "RSI", "params": {"period": int(m.group(1))}, "raw": m.group(0)})
        for m in re.finditer(r"EMA\s*\(\s*(\d+)\s*\)", code_upper):
            found.append({"type": "EMA", "params": {"period": int(m.group(1))}, "raw": m.group(0)})
        for m in re.finditer(r"SMA\s*\(\s*(\d+)\s*\)", code_upper):
            found.append({"type": "SMA", "params": {"period": int(m.group(1))}, "raw": m.group(0)})
        if "VWAP" in code_upper:
            found.append({"type": "VWAP", "params": {}, "raw": "VWAP"})
        for m in re.finditer(r"SUPERTREND\s*\(\s*(\d+)\s*,\s*([\d\.]+)\s*\)", code_upper):
            found.append({"type": "Supertrend", "params": {"period": int(m.group(1)), "multiplier": float(m.group(2))}, "raw": m.group(0)})
        for m in re.finditer(r"MACD\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)", code_upper):
            found.append({"type": "MACD", "params": {"fast": int(m.group(1)), "slow": int(m.group(2)), "signal": int(m.group(3))}, "raw": m.group(0)})
        for m in re.finditer(r"BB_UPPER\s*\(\s*(\d+)\s*,\s*([\d\.]+)\s*\)", code_upper):
            found.append({"type": "BB_Upper", "params": {"period": int(m.group(1)), "std": float(m.group(2))}, "raw": m.group(0)})
        for m in re.finditer(r"BB_LOWER\s*\(\s*(\d+)\s*,\s*([\d\.]+)\s*\)", code_upper):
            found.append({"type": "BB_Lower", "params": {"period": int(m.group(1)), "std": float(m.group(2))}, "raw": m.group(0)})
        for m in re.finditer(r"ATR\s*\(\s*(\d+)\s*\)", code_upper):
            found.append({"type": "ATR", "params": {"period": int(m.group(1))}, "raw": m.group(0)})

        # Deduplicate
        unique = []
        seen = set()
        for item in found:
            key = item["raw"].replace(" ", "")
            if key not in seen:
                seen.add(key)
                unique.append(item)
        return unique

    @staticmethod
    def preprocess_chartink_syntax(expr: str) -> str:
        s = expr.strip()
        # Remove Chartink prefix tags like "[0] 5 minute", "[0]", "[-1] 5 minute"
        s = re.sub(r"\[\s*0\s*\]\s*(\d+\s*(minute|min|hour|day)\s*)?", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\[\s*-1\s*\]\s*(\d+\s*(minute|min|hour|day)\s*)?", "PREV_", s, flags=re.IGNORECASE)
        s = re.sub(r"\[\s*-2\s*\]\s*(\d+\s*(minute|min|hour|day)\s*)?", "PREV2_", s, flags=re.IGNORECASE)

        # Handle crosses above / below
        cross_above_pattern = re.compile(r"([A-Za-z0-9_\(\),\.\*\+\-\/\[\]]+)\s+crosses\s+above\s+([A-Za-z0-9_\(\),\.\*\+\-\/\[\]]+)", re.IGNORECASE)
        s = cross_above_pattern.sub(r"CROSS_ABOVE(\1, \2)", s)

        cross_below_pattern = re.compile(r"([A-Za-z0-9_\(\),\.\*\+\-\/\[\]]+)\s+crosses\s+below\s+([A-Za-z0-9_\(\),\.\*\+\-\/\[\]]+)", re.IGNORECASE)
        s = cross_below_pattern.sub(r"CROSS_BELOW(\1, \2)", s)

        s = re.sub(r"\bis\s+bullish\b", "== 1", s, flags=re.IGNORECASE)
        s = re.sub(r"\bis\s+bearish\b", "== -1", s, flags=re.IGNORECASE)
        return s

    @classmethod
    def parse_system_code(cls, code: str) -> Dict[str, Any]:
        lines = code.split("\n")
        buy_ce_rules = []
        buy_pe_rules = []
        custom_params = {}
        
        current_section = None  # 'CE' or 'PE'
        
        for line_num, raw_line in enumerate(lines, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#") or line.startswith("//"):
                continue
                
            upper = line.upper()
            if "BUY_CE" in upper or "BUY_CALL" in upper or "CALL ENTRY" in upper or "BULLISH" in upper:
                current_section = "CE"
                if ":" in line or "=" in line:
                    sep = ":" if ":" in line else "="
                    rhs = line.split(sep, 1)[1].strip()
                    if rhs:
                        buy_ce_rules.append(cls.preprocess_chartink_syntax(rhs))
                continue
            elif "BUY_PE" in upper or "BUY_PUT" in upper or "PUT ENTRY" in upper or "BEARISH" in upper:
                current_section = "PE"
                if ":" in line or "=" in line:
                    sep = ":" if ":" in line else "="
                    rhs = line.split(sep, 1)[1].strip()
                    if rhs:
                        buy_pe_rules.append(cls.preprocess_chartink_syntax(rhs))
                continue
                
            param_match = re.match(r"^([A-Za-z0-9_]+)\s*=\s*([0-9\.]+)\s*(%|mins)?$", line)
            if param_match:
                key = param_match.group(1).upper()
                val = float(param_match.group(2))
                custom_params[key] = val
                continue
                
            processed = cls.preprocess_chartink_syntax(line)
            if current_section == "CE":
                buy_ce_rules.append(processed)
            elif current_section == "PE":
                buy_pe_rules.append(processed)
            else:
                buy_ce_rules.append(processed)

        ce_expr = " and ".join(f"({r})" for r in buy_ce_rules) if buy_ce_rules else ""
        pe_expr = " and ".join(f"({r})" for r in buy_pe_rules) if buy_pe_rules else ""
        indicators = cls.extract_indicators_and_params(code)
        
        return {
            "valid": True,
            "buy_ce_expr": ce_expr,
            "buy_pe_expr": pe_expr,
            "buy_ce_rules": buy_ce_rules,
            "buy_pe_rules": buy_pe_rules,
            "custom_params": custom_params,
            "indicators": indicators
        }


# ==========================================
# 3. CONTEXT & EVALUATION RUNTIME
# ==========================================

class CustomExecutionContext:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.n = len(df)
        self.variables = {}
        self._precompute_base_series()

    def _precompute_base_series(self):
        close = self.df['close'].to_numpy(dtype=float)
        open_ = self.df['open'].to_numpy(dtype=float)
        high = self.df['high'].to_numpy(dtype=float)
        low = self.df['low'].to_numpy(dtype=float)
        vol = self.df['volume'].to_numpy(dtype=float) if 'volume' in self.df.columns else np.ones(self.n)

        self.variables['CLOSE'] = close
        self.variables['OPEN'] = open_
        self.variables['HIGH'] = high
        self.variables['LOW'] = low
        self.variables['VOLUME'] = vol

        # Offsets
        self.variables['PREV_CLOSE'] = np.roll(close, 1)
        self.variables['PREV_OPEN'] = np.roll(open_, 1)
        self.variables['PREV_HIGH'] = np.roll(high, 1)
        self.variables['PREV_LOW'] = np.roll(low, 1)
        self.variables['PREV_VOLUME'] = np.roll(vol, 1)

        self.variables['PREV2_CLOSE'] = np.roll(close, 2)
        self.variables['PREV2_OPEN'] = np.roll(open_, 2)
        self.variables['PREV2_HIGH'] = np.roll(high, 2)
        self.variables['PREV2_LOW'] = np.roll(low, 2)

    def resolve_indicator(self, ind_call: str) -> np.ndarray:
        clean = ind_call.strip().upper()
        if clean in self.variables:
            return self.variables[clean]

        # Check RSI
        m = re.match(r"^RSI\s*\(\s*(\d+)\s*\)$", clean)
        if m:
            period = int(m.group(1))
            res = calc_rsi(self.variables['CLOSE'], period)
            self.variables[clean] = res
            return res

        # Check EMA
        m = re.match(r"^EMA\s*\(\s*(\d+)\s*\)$", clean)
        if m:
            period = int(m.group(1))
            res = calc_ema(self.variables['CLOSE'], period)
            self.variables[clean] = res
            return res

        # Check SMA
        m = re.match(r"^SMA\s*\(\s*(\d+)\s*\)$", clean)
        if m:
            period = int(m.group(1))
            res = calc_sma(self.variables['CLOSE'], period)
            self.variables[clean] = res
            return res

        # Check VWAP
        if clean == "VWAP":
            res = calc_vwap(self.df)
            self.variables[clean] = res
            return res

        # Check Supertrend
        m = re.match(r"^SUPERTREND\s*\(\s*(\d+)\s*,\s*([\d\.]+)\s*\)$", clean)
        if m:
            p = int(m.group(1))
            mult = float(m.group(2))
            st, dir_ = calc_supertrend(self.variables['HIGH'], self.variables['LOW'], self.variables['CLOSE'], p, mult)
            self.variables[clean] = dir_
            self.variables[f"{clean}_LINE"] = st
            return dir_

        # Check MACD
        m = re.match(r"^MACD\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$", clean)
        if m:
            f = int(m.group(1))
            s = int(m.group(2))
            sig = int(m.group(3))
            ml, sl, hist = calc_macd(self.variables['CLOSE'], f, s, sig)
            self.variables[clean] = hist
            self.variables[f"{clean}_LINE"] = ml
            self.variables[f"{clean}_SIGNAL"] = sl
            return hist

        # Check BB_UPPER / LOWER / MIDDLE
        m = re.match(r"^BB_(UPPER|LOWER|MIDDLE)\s*\(\s*(\d+)\s*,\s*([\d\.]+)\s*\)$", clean)
        if m:
            band = m.group(1)
            p = int(m.group(2))
            dev = float(m.group(3))
            up, mid, low = calc_bollinger_bands(self.variables['CLOSE'], p, dev)
            if band == "UPPER":
                res = up
            elif band == "LOWER":
                res = low
            else:
                res = mid
            self.variables[clean] = res
            return res

        # Check ATR
        m = re.match(r"^ATR\s*\(\s*(\d+)\s*\)$", clean)
        if m:
            p = int(m.group(1))
            res = calc_atr(self.variables['HIGH'], self.variables['LOW'], self.variables['CLOSE'], p)
            self.variables[clean] = res
            return res

        try:
            val = float(clean)
            return np.full(self.n, val)
        except:
            return np.zeros(self.n)


class SafeEvaluator(ast.NodeVisitor):
    ALLOWED_OPERATORS = {
        ast.Add: np.add,
        ast.Sub: np.subtract,
        ast.Mult: np.multiply,
        ast.Div: np.divide,
        ast.Gt: lambda a, b: a > b,
        ast.Lt: lambda a, b: a < b,
        ast.GtE: lambda a, b: a >= b,
        ast.LtE: lambda a, b: a <= b,
        ast.Eq: lambda a, b: np.isclose(a, b, atol=1e-4),
        ast.NotEq: lambda a, b: ~np.isclose(a, b, atol=1e-4),
        ast.And: lambda a, b: a & b,
        ast.Or: lambda a, b: a | b,
    }

    def __init__(self, ctx: CustomExecutionContext):
        self.ctx = ctx

    def evaluate(self, expr_str: str) -> np.ndarray:
        if not expr_str.strip():
            return np.zeros(self.ctx.n, dtype=bool)

        placeholders = {}

        def replacer(match):
            raw = match.group(0)
            pname = f"VAR_IND_{len(placeholders)}"
            placeholders[pname] = raw
            return pname

        transformed_expr = re.sub(r"[A-Za-z0-9_]+\s*\([^\)]*\)", replacer, expr_str)

        try:
            tree = ast.parse(transformed_expr, mode='eval')
        except SyntaxError as e:
            raise ValueError(f"Invalid condition syntax: '{expr_str}'. Detail: {str(e)}")

        return self.visit(tree.body, placeholders)

    def visit(self, node: ast.AST, placeholders: dict) -> np.ndarray:
        if isinstance(node, ast.BinOp):
            left = self.visit(node.left, placeholders)
            right = self.visit(node.right, placeholders)
            op_func = self.ALLOWED_OPERATORS.get(type(node.op))
            if not op_func:
                raise ValueError(f"Unsupported operator: {type(node.op)}")
            return op_func(left, right)

        elif isinstance(node, ast.Compare):
            left = self.visit(node.left, placeholders)
            result = np.ones(self.ctx.n, dtype=bool)
            for op, comparator in zip(node.ops, node.comparators):
                right = self.visit(comparator, placeholders)
                op_func = self.ALLOWED_OPERATORS.get(type(op))
                if not op_func:
                    raise ValueError(f"Unsupported comparison operator: {type(op)}")
                comp_res = op_func(left, right)
                result = result & comp_res
                left = right
            return result

        elif isinstance(node, ast.BoolOp):
            values = [self.visit(val, placeholders) for val in node.values]
            op_func = self.ALLOWED_OPERATORS.get(type(node.op))
            res = values[0]
            for v in values[1:]:
                res = op_func(res, v)
            return res

        elif isinstance(node, ast.UnaryOp):
            operand = self.visit(node.operand, placeholders)
            if isinstance(node.op, ast.Not):
                return ~operand
            elif isinstance(node.op, ast.USub):
                return -operand
            return operand

        elif isinstance(node, ast.Constant):
            return np.full(self.ctx.n, float(node.value))

        elif isinstance(node, ast.Name):
            name = node.id
            if name in placeholders:
                raw_call = placeholders[name]
                if raw_call.startswith("CROSS_ABOVE("):
                    inner = raw_call[12:-1]
                    parts = [p.strip() for p in inner.split(",", 1)]
                    a = self.ctx.resolve_indicator(parts[0])
                    b = self.ctx.resolve_indicator(parts[1])
                    prev_a = np.roll(a, 1)
                    prev_b = np.roll(b, 1)
                    cross = (a > b) & (prev_a <= prev_b)
                    cross[0] = False
                    return cross
                elif raw_call.startswith("CROSS_BELOW("):
                    inner = raw_call[12:-1]
                    parts = [p.strip() for p in inner.split(",", 1)]
                    a = self.ctx.resolve_indicator(parts[0])
                    b = self.ctx.resolve_indicator(parts[1])
                    prev_a = np.roll(a, 1)
                    prev_b = np.roll(b, 1)
                    cross = (a < b) & (prev_a >= prev_b)
                    cross[0] = False
                    return cross
                return self.ctx.resolve_indicator(raw_call)

            return self.ctx.resolve_indicator(name)

        elif isinstance(node, ast.Subscript):
            base_name = node.value.id if isinstance(node.value, ast.Name) else "CLOSE"
            slice_val = -1
            if isinstance(node.slice, ast.Constant):
                slice_val = int(node.slice.value)
            elif isinstance(node.slice, ast.UnaryOp) and isinstance(node.slice.operand, ast.Constant):
                slice_val = -int(node.slice.operand.value)
            
            base_arr = self.ctx.resolve_indicator(base_name)
            rolled = np.roll(base_arr, -slice_val)
            return rolled

        raise ValueError(f"Unsupported syntax construct: {ast.dump(node)}")


# ==========================================
# 4. SIGNAL GENERATION & BACKTEST SIMULATION
# ==========================================

def generate_custom_signals(df: pd.DataFrame, buy_ce_expr: str, buy_pe_expr: str) -> List[Dict[str, Any]]:
    if len(df) < 5:
        return []

    ctx = CustomExecutionContext(df)
    evaluator = SafeEvaluator(ctx)

    ce_mask = evaluator.evaluate(buy_ce_expr) if buy_ce_expr else np.zeros(len(df), dtype=bool)
    pe_mask = evaluator.evaluate(buy_pe_expr) if buy_pe_expr else np.zeros(len(df), dtype=bool)

    signals = []
    warmup = min(20, len(df) - 1)
    
    for i in range(warmup, len(df)):
        row = df.iloc[i]
        ts = str(row['timestamp'])
        spot = float(row['close'])
        
        indicators_snapshot = {}
        for k in ['RSI(14)', 'EMA(20)', 'EMA(50)', 'VWAP', 'SUPERTREND(10, 3)']:
            if k in ctx.variables:
                indicators_snapshot[k] = round(float(ctx.variables[k][i]), 2)

        if ce_mask[i] and not pe_mask[i]:
            signals.append({
                "timestamp": ts,
                "direction": "BULLISH_CE",
                "spot_price": spot,
                "indicators": indicators_snapshot,
                "candle": {
                    "open": float(row['open']),
                    "high": float(row['high']),
                    "low": float(row['low']),
                    "close": spot,
                    "volume": float(row['volume']) if 'volume' in row else 0
                }
            })
        elif pe_mask[i] and not ce_mask[i]:
            signals.append({
                "timestamp": ts,
                "direction": "BEARISH_PE",
                "spot_price": spot,
                "indicators": indicators_snapshot,
                "candle": {
                    "open": float(row['open']),
                    "high": float(row['high']),
                    "low": float(row['low']),
                    "close": spot,
                    "volume": float(row['volume']) if 'volume' in row else 0
                }
            })

    return signals


def bs_pricing(S: float, K: float, T: float, r: float, sigma: float, option_type: str = "C") -> float:
    from math import log, sqrt, exp
    from scipy.stats import norm
    if T <= 0:
        return max(0.0, S - K) if option_type.upper().startswith("C") else max(0.0, K - S)
    if sigma <= 0 or S <= 0 or K <= 0:
        return 0.0
    try:
        d1 = (log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrt(T))
        d2 = d1 - sigma * sqrt(T)
        if option_type.upper().startswith("C"):
            return S * norm.cdf(d1) - K * exp(-r * T) * norm.cdf(d2)
        else:
            return K * exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
    except:
        return 0.0


def run_custom_system_backtest(
    all_candles: List[dict],
    vix_series: pd.Series,
    symbol: str,
    buy_ce_expr: str,
    buy_pe_expr: str,
    moneyness: str = "ATM",
    take_profit_pct: Optional[float] = 25.0,
    stop_loss_pct: Optional[float] = 15.0,
    initial_capital: float = 100000.0,
    slippage: float = 0.5,
    lot_multiplier: int = 25,
    strike_round: int = 50,
    expiry_type: str = "weekly",
    lots: int = 1
) -> Dict[str, Any]:
    df = pd.DataFrame(all_candles)
    if len(df) < 25:
        return {
            "metrics": {
                "initialCapital": initial_capital, "finalCapital": initial_capital, "netPnL": 0.0,
                "netReturnPct": 0.0, "winRate": 0.0, "profitFactor": 0.0, "maxDrawdown": 0.0,
                "totalTrades": 0, "winningTrades": 0, "losingTrades": 0, "targetHits": 0
            },
            "trades": [], "equityCurve": []
        }

    signals = generate_custom_signals(df, buy_ce_expr, buy_pe_expr)
    signals_map = {s["timestamp"]: s for s in signals}

    capital = initial_capital
    peak_capital = initial_capital
    max_dd_val = 0.0
    trades_log = []
    equity_curve = []
    holding_mins = []
    target_hits = 0
    sl_hits = 0
    r = 0.065
    total_qty = max(1, lots) * lot_multiplier

    def get_dte(cdt_str: str, expiry_date: datetime) -> float:
        cdt = datetime.strptime(cdt_str, "%Y-%m-%d %H:%M:%S")
        days_diff = (expiry_date.date() - cdt.date()).days
        close_time = cdt.replace(hour=15, minute=30, second=0)
        seconds_left = max(0, (close_time - cdt).total_seconds())
        frac = seconds_left / (24 * 3600)
        return max(0.0001, (days_diff - 1 + frac) / 365.0) if days_diff > 0 else max(0.0, seconds_left / (365 * 24 * 3600))

    def get_weekly_expiry(dt: datetime) -> datetime:
        days_ahead = (3 - dt.weekday()) % 7
        if days_ahead == 0 and dt.hour >= 15:
            days_ahead = 7
        return (dt + pd.Timedelta(days=days_ahead)).replace(hour=15, minute=30, second=0)

    current_trade = None

    for i, row in df.iterrows():
        ts = str(row['timestamp'])
        spot = float(row['close'])
        dt_obj = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
        date_str = ts.split(" ")[0]
        time_part = ts.split(" ")[1]
        h, m = map(int, time_part.split(":")[:2])
        time_mins = h * 60 + m

        if current_trade is not None:
            expiry_dt = current_trade["expiryDate"]
            T_years = get_dte(ts, expiry_dt)
            dist_pct = (current_trade["strike"] - spot) / spot
            
            try:
                vix_val = float(vix_series.loc[pd.to_datetime(date_str)])
            except:
                vix_val = 15.0
            base_iv = max(0.08, vix_val / 100.0)
            leg_iv = base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)
            leg_iv = max(0.08, min(1.0, leg_iv))

            current_prem = bs_pricing(spot, current_trade["strike"], T_years, r, leg_iv, current_trade["optionType"])
            trade_pnl = (current_prem - current_trade["entryPremium"]) * total_qty
            entry_cost = current_trade["entryPremium"] * total_qty

            exit_reason = None
            if take_profit_pct and entry_cost > 0 and (trade_pnl >= entry_cost * (take_profit_pct / 100.0)):
                exit_reason = f"Target Hit (+{take_profit_pct}%)"
                target_hits += 1
            elif stop_loss_pct and entry_cost > 0 and (trade_pnl <= -entry_cost * (stop_loss_pct / 100.0)):
                exit_reason = f"Stop Loss (-{stop_loss_pct}%)"
                sl_hits += 1
            elif time_mins >= (15 * 60 + 20):
                exit_reason = "Intraday EOD Squareoff"
            elif ts in signals_map and signals_map[ts]["direction"] != current_trade["direction"]:
                exit_reason = "Opposite Reversal Signal"

            if exit_reason is not None:
                net_pnl = float(trade_pnl - (slippage * 2 * total_qty))
                capital += net_pnl
                peak_capital = max(peak_capital, capital)
                dd = (peak_capital - capital) / peak_capital * 100.0
                max_dd_val = max(max_dd_val, dd)

                ent_dt = datetime.strptime(current_trade["entryTime"], "%Y-%m-%d %H:%M:%S")
                dur_mins = max(5, int((dt_obj - ent_dt).total_seconds() / 60))
                holding_mins.append(dur_mins)

                trades_log.append({
                    "tradeId": len(trades_log) + 1,
                    "symbol": symbol,
                    "direction": current_trade["direction"],
                    "strategyName": f"Custom Algo ({current_trade['direction']})",
                    "entryDate": current_trade["entryTime"],
                    "exitDate": ts,
                    "entrySpot": round(float(current_trade["entrySpot"]), 2),
                    "exitSpot": round(float(spot), 2),
                    "strike": int(current_trade["strike"]),
                    "optionType": current_trade["optionType"],
                    "entryPrice": round(float(current_trade["entryPremium"]), 2),
                    "exitPrice": round(float(current_prem), 2),
                    "exitReason": exit_reason,
                    "duration": f"{dur_mins} mins",
                    "netPnL": round(float(net_pnl), 2),
                    "runningCapital": round(float(capital), 2)
                })
                current_trade = None

        if current_trade is None and (9 * 60 + 20) <= time_mins <= (15 * 60 + 0):
            if ts in signals_map:
                sig = signals_map[ts]
                direction = sig["direction"]
                atm_strike = round(spot / strike_round) * strike_round
                m_upper = moneyness.upper()

                if direction == "BULLISH_CE":
                    leg_type = "C"
                    strike = atm_strike + (strike_round if m_upper == "OTM1" else (strike_round * 2 if m_upper == "OTM2" else (-strike_round if m_upper == "ITM" else 0)))
                else:
                    leg_type = "P"
                    strike = atm_strike - (strike_round if m_upper == "OTM1" else (strike_round * 2 if m_upper == "OTM2" else (-strike_round if m_upper == "ITM" else 0)))

                expiry_dt = get_weekly_expiry(dt_obj)
                T_years = get_dte(ts, expiry_dt)
                dist_pct = (strike - spot) / spot
                try:
                    vix_val = float(vix_series.loc[pd.to_datetime(date_str)])
                except:
                    vix_val = 15.0
                base_iv = max(0.08, vix_val / 100.0)
                leg_iv = max(0.08, min(1.0, base_iv - 0.50 * dist_pct + 0.30 * (dist_pct ** 2)))

                entry_prem = float(bs_pricing(spot, strike, T_years, r, leg_iv, leg_type))
                entry_prem += slippage

                current_trade = {
                    "entryTime": ts,
                    "direction": direction,
                    "entrySpot": float(spot),
                    "strike": strike,
                    "optionType": leg_type,
                    "entryPremium": max(1.5, float(entry_prem)),
                    "expiryDate": expiry_dt,
                }

        equity_curve.append({
            "timestamp": ts,
            "capital": round(float(capital), 2),
            "spot": round(float(spot), 2)
        })

    total_trades = len(trades_log)
    win_trades = [t for t in trades_log if t["netPnL"] > 0]
    loss_trades = [t for t in trades_log if t["netPnL"] <= 0]
    win_rate = (len(win_trades) / total_trades * 100.0) if total_trades > 0 else 0.0
    
    gross_profits = sum(t["netPnL"] for t in win_trades)
    gross_losses = abs(sum(t["netPnL"] for t in loss_trades))
    profit_factor = round(gross_profits / gross_losses, 2) if gross_losses > 0 else (999.0 if gross_profits > 0 else 0.0)
    net_pnl = capital - initial_capital
    net_return_pct = (net_pnl / initial_capital) * 100.0

    avg_holding = f"{int(np.mean(holding_mins))} mins" if holding_mins else "-"

    metrics = {
        "initialCapital": initial_capital,
        "finalCapital": round(capital, 2),
        "netPnL": round(net_pnl, 2),
        "netReturnPct": round(net_return_pct, 2),
        "winRate": round(win_rate, 2),
        "profitFactor": profit_factor,
        "maxDrawdown": round(max_dd_val, 2),
        "totalTrades": total_trades,
        "winningTrades": len(win_trades),
        "losingTrades": len(loss_trades),
        "targetHits": target_hits,
        "slHits": sl_hits,
        "avgHoldingTime": avg_holding
    }

    return {
        "metrics": metrics,
        "trades": trades_log,
        "equityCurve": equity_curve[::max(1, len(equity_curve) // 150)]
    }
