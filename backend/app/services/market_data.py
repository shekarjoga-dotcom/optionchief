import yfinance as yf
import pandas as pd
import numpy as np
import httpx
from bs4 import BeautifulSoup
import math
import random
from datetime import datetime, timedelta
from app.quant.black_scholes import bs_implied_volatility, bs_pricing, bs_greeks
import os

# Map user-friendly symbols to Yahoo tickers
SYMBOL_MAPPING = {
    "NIFTY": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "SENSEX": "^BSESN",
    "NIFTYIT": "^CNXIT",
    "NIFTYCPSE": "NIFTY_CPSE.NS", # or custom mock
    "SPY": "SPY",
    "AAPL": "AAPL",
    "MSFT": "MSFT",
    "TSLA": "TSLA",
    "SBIN": "SBIN.NS",
    "ITC": "ITC.NS",
    "RELIANCE": "RELIANCE.NS",
    "GOLD": "GC=F",
    "GOLDM": "GC=F",
    "SILVER": "SI=F",
    "SILVERM": "SI=F",
    "CRUDEOIL": "CL=F",
    "CRUDEOILM": "CL=F",
    "NATURALGAS": "NG=F",
    "NATGASMINI": "NG=F",
    "BTC": "BTC-USD",
    "ETH": "ETH-USD"
}

NSE_FO_STOCKS = [
    "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "ITC", "LT", "SBIN", "HINDUNILVR", 
    "LTIM", "HCLTECH", "AXISBANK", "ASIANPAINT", "KOTAKBANK", "MARUTI", "SUNPHARMA", "NTPC", "TATAMOTORS", "COALINDIA", 
    "TATASTEEL", "ONGC", "ADANIENT", "JSWSTEEL", "TITAN", "POWERGRID", "M&M", "ULTRACEMCO", "BAJFINANCE", "GRASIM", 
    "HINDALCO", "BPCL", "HEROMOTOCO", "NESTLEIND", "CIPLA", "WIPRO", "ADANIPORTS", "APOLLOHOSP", "DIVISLAB", "TATACONSUM", 
    "DRREDDY", "BAJAJFINSV", "EICHERMOT", "JINDALSTEL", "HDFCLIFE", "SHRIRAMFIN", "INDUSINDBK", "BRITANNIA", "TECHM"
]

class MarketDataService:
    def __init__(self):
        self.client = httpx.Client(
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.nseindia.com/"
            },
            follow_redirects=True,
            timeout=10.0
        )
        self._nse_cookies = None
        
        # Initialize curl_cffi session for NSE scraping
        try:
            from curl_cffi import requests as curl_requests
            self._nse_session = curl_requests.Session()
            self._nse_session.headers.update({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Referer": "https://www.nseindia.com/option-chain"
            })
            self._has_curl_cffi = True
        except ImportError:
            self._has_curl_cffi = False
            self._nse_session = None
        
        # Dhan API configuration
        self.dhan_client_id = os.getenv("DHAN_CLIENT_ID")
        self.dhan_access_token = os.getenv("DHAN_ACCESS_TOKEN")
        self.is_dhan_enabled = bool(self.dhan_client_id and self.dhan_access_token)
        
        if self.is_dhan_enabled:
            print(f"[Dhan API] Found Dhan API credentials. Initializing live client for ID: {self.dhan_client_id}")
            try:
                from dhanhq import dhanhq, DhanContext
                context = DhanContext(self.dhan_client_id, self.dhan_access_token)
                self.dhan = dhanhq(context)
                print("[Dhan API] Live client connected successfully.")
            except ImportError:
                print("[Dhan API] dhanhq library is not installed. Please run 'pip install dhanhq' to enable live broker feeds.")
                self.is_dhan_enabled = False

    def _clean_symbol(self, symbol: str) -> str:
        symbol_upper = symbol.upper()
        if symbol_upper.endswith("1!"):
            symbol_upper = symbol_upper[:-2]
        if symbol_upper == "NATURALGASM":
            return "NATGASMINI"
        if symbol_upper == "CRUDEM":
            return "CRUDEOILM"
        return symbol_upper

    def get_underlying_data(self, symbol: str) -> dict:
        """
        Fetches the current spot price, day high, day low, bid/ask and price change.
        """
        symbol_clean = self._clean_symbol(symbol)
        
        if self.is_dhan_enabled:
            scrip_info = self._get_dhan_scrip_info(symbol_clean)
            if scrip_info:
                try:
                    sec_id = scrip_info["security_id"]
                    segment = scrip_info["segment"]
                    
                    # For MCX, segment is M in the CSV. But Dhan API expects MCX_COMM segment
                    api_seg = "MCX_COMM" if segment == "M" else segment
                    
                    ohlc_resp = self.dhan.ohlc_data({api_seg: [sec_id]})
                    if ohlc_resp and ohlc_resp.get("status") == "success":
                        data_map = ohlc_resp.get("data", {}).get(api_seg, {}).get(sec_id, {})
                        if data_map:
                            spot = float(data_map.get("last_price") or data_map.get("close") or 0.0)
                            open_p = float(data_map.get("open") or spot)
                            high_p = float(data_map.get("high") or spot)
                            low_p = float(data_map.get("low") or spot)
                            prev_close = float(data_map.get("close") or spot)
                            
                            change = spot - prev_close
                            pct_change = (change / prev_close * 100.0) if prev_close > 0 else 0.0
                            
                            return {
                                "symbol": symbol.upper(),
                                "ticker": symbol_clean,
                                "spot": spot,
                                "open": open_p,
                                "high": high_p,
                                "low": low_p,
                                "previous_close": prev_close,
                                "change": round(change, 2),
                                "pct_change": round(pct_change, 2),
                                "volume": int(data_map.get("volume", 0))
                            }
                except Exception as e:
                    print(f"[Dhan API] Error fetching underlying data from Dhan: {str(e)}")
                    
        ticker_symbol = SYMBOL_MAPPING.get(symbol_clean, symbol_clean)
        if symbol_clean in NSE_FO_STOCKS and not ticker_symbol.endswith(".NS"):
            ticker_symbol = f"{symbol_clean}.NS"
        try:
            ticker = yf.Ticker(ticker_symbol)
            info = ticker.info
            
            # Extract standard fields
            spot = info.get("regularMarketPrice") or info.get("currentPrice") or info.get("previousClose")
            
            if spot is None:
                # Try fetching recent history
                hist = ticker.history(period="5d")
                if not hist.empty:
                    spot = hist['Close'].iloc[-1]
                else:
                    spot = 100.0 # final fallback
                    
            prev_close = info.get("regularMarketPreviousClose") or spot
            
            # Convert commodity prices from USD to INR using unit-specific multipliers
            multiplier = 1.0
            is_commodity = symbol_clean in ["GOLD", "GOLDM", "SILVER", "SILVERM", "CRUDEOIL", "CRUDEOILM", "NATURALGAS", "NATGASMINI"]
            if is_commodity:
                usd_inr = 83.5
                if symbol_clean in ["CRUDEOIL", "CRUDEOILM"]:
                    multiplier = usd_inr
                elif symbol_clean in ["NATURALGAS", "NATGASMINI"]:
                    multiplier = usd_inr
                elif symbol_clean in ["GOLD", "GOLDM"]:
                    # 1 troy ounce = 31.1035 grams, priced per 10g in India. Adjusting by ~1.314 to account for import duty, cess, and local taxes.
                    multiplier = ((usd_inr * 10) / 31.1035) * 1.314
                elif symbol_clean in ["SILVER", "SILVERM"]:
                    # Priced per kg in India. Adjusting by ~1.324 to account for import duty, local taxes, and freight premiums.
                    multiplier = ((usd_inr * 1000) / 31.1035) * 1.324
                    
            spot = spot * multiplier
            prev_close = prev_close * multiplier
            
            open_val = (info.get("regularMarketOpen") or (spot / multiplier)) * multiplier
            high_val = (info.get("regularMarketDayHigh") or (spot / multiplier)) * multiplier
            low_val = (info.get("regularMarketDayLow") or (spot / multiplier)) * multiplier
            
            change = spot - prev_close
            pct_change = (change / prev_close) * 100 if prev_close else 0.0

            return {
                "symbol": symbol.upper(),
                "ticker": ticker_symbol,
                "spot": float(spot),
                "open": float(open_val),
                "high": float(high_val),
                "low": float(low_val),
                "previous_close": float(prev_close),
                "change": float(change),
                "pct_change": float(pct_change),
                "volume": int(info.get("regularMarketVolume") or 0)
            }
        except Exception as e:
            print(f"Error fetching data for {symbol}: {str(e)}")
            # Return simulation data if backend fetch fails
            return self._generate_mock_underlying(symbol)

    def get_historical_prices(self, symbol: str, period: str = "1y") -> list:
        """
        Fetches a list of daily close prices for volatility calculations.
        """
        symbol_clean = self._clean_symbol(symbol)
        ticker_symbol = SYMBOL_MAPPING.get(symbol_clean, symbol_clean)
        if symbol_clean in NSE_FO_STOCKS and not ticker_symbol.endswith(".NS"):
            ticker_symbol = f"{symbol_clean}.NS"
        try:
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(period=period)
            if hist.empty:
                # Return standard simulation prices
                return [100.0 * (1.0 + 0.01 * math.sin(i / 10.0)) for i in range(250)]
                
            # Apply multiplier for commodity prices to calculate correct volatility/cone metrics
            multiplier = 1.0
            is_commodity = symbol_clean in ["GOLD", "GOLDM", "SILVER", "SILVERM", "CRUDEOIL", "CRUDEOILM", "NATURALGAS", "NATGASMINI"]
            if is_commodity:
                usd_inr = 83.5
                if symbol_clean in ["CRUDEOIL", "CRUDEOILM"]:
                    multiplier = usd_inr
                elif symbol_clean in ["NATURALGAS", "NATGASMINI"]:
                    multiplier = usd_inr
                elif symbol_clean in ["GOLD", "GOLDM"]:
                    multiplier = ((usd_inr * 10) / 31.1035) * 1.314
                elif symbol_clean in ["SILVER", "SILVERM"]:
                    multiplier = ((usd_inr * 1000) / 31.1035) * 1.324
                    
            return (hist['Close'].dropna() * multiplier).tolist()
        except Exception as e:
            print(f"Error fetching historical prices: {str(e)}")
            return [100.0 * (1.0 + 0.01 * math.sin(i / 10.0)) for i in range(250)]

    def get_option_chain(self, symbol: str, expiry: str = None) -> dict:
        """
        Fetches the option chain for a given symbol and expiry.
        If expiry is None, returns the first available expiry data.
        """
        symbol_clean = self._clean_symbol(symbol)
        if symbol_clean == "ALL_NSE":
            chain = self.get_option_chain("NIFTY", expiry)
            if chain and "underlying" in chain:
                chain["underlying"]["symbol"] = "ALL_NSE"
                chain["underlying"]["ticker"] = "ALL_NSE"
            return chain
        
        if self.is_dhan_enabled:
            scrip_info = self._get_dhan_scrip_info(symbol_clean)
            if scrip_info:
                try:
                    sec_id = int(scrip_info["security_id"])
                    segment = scrip_info["segment"]
                    
                    expiries = self._get_valid_expiries(symbol_clean)
                    if not expiries:
                        expiries = [ (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7) ]
                        
                    selected_expiry = expiry if expiry in expiries else expiries[0]
                    
                    # For MCX segment, convert M to MCX_COMM in Dhan API call
                    api_seg = "MCX_COMM" if segment == "M" else segment
                    
                    print(f"[Dhan API] Fetching live option chain for {symbol_clean} / Expiry: {selected_expiry}...")
                    
                    chain_resp = self.dhan.option_chain(
                        under_security_id=sec_id,
                        under_exchange_segment=api_seg,
                        expiry=selected_expiry
                    )
                    
                    if chain_resp and chain_resp.get("status") == "success":
                        chain_data = chain_resp.get("data", {})
                        spot = float(chain_data.get("last_price") or 0.0)
                        oc_dict = chain_data.get("oc", {})
                        
                        if not oc_dict:
                            raise ValueError(f"Dhan returned empty option chain for {selected_expiry}")
                        
                        underlying_data = {
                            "symbol": symbol.upper(),
                            "ticker": symbol_clean,
                            "spot": spot,
                            "open": spot,
                            "high": spot,
                            "low": spot,
                            "previous_close": spot,
                            "change": 0.0,
                            "pct_change": 0.0,
                            "volume": 0
                        }
                        
                        options_list = []
                        total_ce_oi = 0
                        total_pe_oi = 0
                        
                        for strike_str, strike_data in oc_dict.items():
                            strike = float(strike_str)
                            ce_raw = strike_data.get("ce")
                            pe_raw = strike_data.get("pe")
                            
                            parsed_ce = self._parse_dhan_leg(ce_raw, strike, 'C') if ce_raw else None
                            parsed_pe = self._parse_dhan_leg(pe_raw, strike, 'P') if pe_raw else None
                            
                            if parsed_ce:
                                total_ce_oi += parsed_ce["openInterest"]
                            if parsed_pe:
                                total_pe_oi += parsed_pe["openInterest"]
                                
                            options_list.append({
                                "strike": strike,
                                "CE": parsed_ce,
                                "PE": parsed_pe
                            })
                            
                        options_list = sorted(options_list, key=lambda x: x["strike"])
                        if symbol_clean in ["GOLD", "GOLDM"]:
                            options_list = [o for o in options_list if round(o["strike"]) % 1000 == 0]
                        elif symbol_clean in ["SILVER", "SILVERM"]:
                            options_list = [o for o in options_list if round(o["strike"]) % 1000 == 0]
                        options_list = [o for o in options_list if spot * 0.85 <= o["strike"] <= spot * 1.15]
                        
                        pcr = total_pe_oi / total_ce_oi if total_ce_oi > 0 else 0.0
                        
                        return {
                            "underlying": underlying_data,
                            "expiry_dates": expiries[:10],
                            "selected_expiry": selected_expiry,
                            "pcr": round(pcr, 4),
                            "options": options_list
                        }
                except Exception as e:
                    print(f"[Dhan API] Error loading live option chain from Dhan: {str(e)}")

        ticker_symbol = SYMBOL_MAPPING.get(symbol_clean, symbol_clean)

        # Decide whether to fetch from US options (yfinance) or simulate/scrape NSE
        # Standard domestic assets that route to MCX or NSE fallbacks (versus US options)
        is_nse_symbol = symbol_clean in NSE_FO_STOCKS or symbol_clean in [
            "NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYIT", "NIFTYCPSE", 
            "GOLD", "GOLDM", "SILVER", "SILVERM", "CRUDEOIL", "CRUDEOILM", "NATURALGAS", "NATGASMINI"
        ]

        if is_nse_symbol:
            # Let's try direct NSE scraping first. If it fails, use mock/simulated options chain.
            chain = self._try_scrape_nse(symbol_clean, expiry)
            if chain:
                if "underlying" in chain:
                    chain["underlying"]["symbol"] = symbol.upper()
                return chain
            return self._generate_mock_option_chain(symbol, expiry)
        else:
            # US Options - Yahoo Finance
            try:
                ticker = yf.Ticker(ticker_symbol)
                expiries = ticker.options
                if not expiries:
                    return self._generate_mock_option_chain(symbol, expiry)
                
                selected_expiry = expiry if expiry in expiries else expiries[0]
                opt = ticker.option_chain(selected_expiry)
                
                spot_data = self.get_underlying_data(symbol)
                spot = spot_data["spot"]
                
                calls = self._parse_yf_chain(opt.calls, spot, selected_expiry, 'C')
                puts = self._parse_yf_chain(opt.puts, spot, selected_expiry, 'P')
                
                # Combine calls and puts by strike
                strikes_dict = {}
                for c in calls:
                    strike = c["strike"]
                    if strike not in strikes_dict:
                        strikes_dict[strike] = {"strike": strike, "CE": None, "PE": None}
                    strikes_dict[strike]["CE"] = c
                    
                for p in puts:
                    strike = p["strike"]
                    if strike not in strikes_dict:
                        strikes_dict[strike] = {"strike": strike, "CE": None, "PE": None}
                    strikes_dict[strike]["PE"] = p
                    
                strikes_list = sorted(list(strikes_dict.values()), key=lambda x: x["strike"])

                # Filter strikes to be +/- 20% around spot for visualization performance
                lower_bound = spot * 0.8
                upper_bound = spot * 1.2
                strikes_list = [s for s in strikes_list if lower_bound <= s["strike"] <= upper_bound]

                # Compute overall PCR
                total_ce_oi = sum(c["openInterest"] for c in calls if c["openInterest"])
                total_pe_oi = sum(p["openInterest"] for p in puts if p["openInterest"])
                pcr = total_pe_oi / total_ce_oi if total_ce_oi > 0 else 0.0

                return {
                    "underlying": spot_data,
                    "expiry_dates": expiries[:10], # next 10 dates
                    "selected_expiry": selected_expiry,
                    "pcr": round(pcr, 4),
                    "options": strikes_list
                }
            except Exception as e:
                print(f"Error fetching option chain from Yahoo: {str(e)}")
                return self._generate_mock_option_chain(symbol, expiry)

    def _parse_yf_chain(self, df: pd.DataFrame, spot: float, expiry_str: str, option_type: str) -> list:
        parsed = []
        # Calculate time to expiry in years
        expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d")
        now = datetime.now()
        days_to_expiry = max(1, (expiry_date - now).days)
        T = days_to_expiry / 365.0
        r = 0.05 # standard interest rate

        for _, row in df.iterrows():
            strike = float(row["strike"])
            ltp = float(row["lastPrice"]) if not pd.isna(row["lastPrice"]) else 0.0
            bid = float(row["bid"]) if not pd.isna(row["bid"]) else 0.0
            ask = float(row["ask"]) if not pd.isna(row["ask"]) else 0.0
            change = float(row["change"]) if not pd.isna(row["change"]) else 0.0
            pct_change = float(row["percentChange"]) if not pd.isna(row["percentChange"]) else 0.0
            volume = int(row["volume"]) if not pd.isna(row["volume"]) else 0
            oi = int(row["openInterest"]) if not pd.isna(row["openInterest"]) else 0
            
            # Calculate/Use Implied Volatility
            iv = float(row["impliedVolatility"]) if not pd.isna(row["impliedVolatility"]) else 0.0
            if iv <= 0:
                mid_price = (bid + ask) / 2.0 if (bid > 0 and ask > 0) else ltp
                iv = bs_implied_volatility(mid_price, spot, strike, T, r, option_type) or 0.20 # default 20% if solver fails
            
            # OI Analysis category (simulated for YF since historical intraday changes are not in standard EOD response)
            # Long buildup: Price up, OI up
            # Short buildup: Price down, OI up
            # Long liquidation: Price down, OI down
            # Short covering: Price up, OI down
            oi_analysis = "Neutral"
            if change > 0 and oi > 100:
                oi_analysis = "Long Buildup" if random.random() > 0.5 else "Short Covering"
            elif change < 0 and oi > 100:
                oi_analysis = "Short Buildup" if random.random() > 0.5 else "Long Liquidation"

            # Calculate Delta
            try:
                greeks = bs_greeks(spot, strike, T, r, iv, option_type)
                delta = float(greeks.get("delta") or 0.0)
            except Exception:
                delta = 0.5 if option_type == 'C' else -0.5

            parsed.append({
                "strike": strike,
                "optionType": option_type,
                "lastPrice": ltp,
                "bid": bid,
                "ask": ask,
                "change": change,
                "pctChange": pct_change,
                "volume": volume,
                "openInterest": oi,
                "impliedVolatility": iv,
                "oiAnalysis": oi_analysis,
                "delta": delta,
                "bidQty": 0.0,
                "askQty": 0.0,
                "bidIv": iv,
                "askIv": iv
            })
        return parsed

    def _try_scrape_nse(self, symbol: str, expiry: str = None) -> dict:
        """
        Attempts to scrape Option Chain from NSE India website.
        Handles session cookies and referers properly.
        Returns None if blocked or fails, triggering mock fallback.
        """
        if not self._has_curl_cffi:
            return None
        
        base_url = "https://www.nseindia.com"
        is_index = symbol in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYIT", "NIFTYCPSE"]
        
        try:
            # 1. Fetch main page to initialize cookies if not already done
            if not self._nse_session.cookies:
                self._nse_session.get(f"{base_url}/option-chain", impersonate="chrome120")
            
            # 2. Get contract info (expiry dates and strikes)
            contract_info_url = f"{base_url}/api/option-chain-contract-info?symbol={symbol}"
            info_resp = self._nse_session.get(contract_info_url, impersonate="chrome120")
            
            # If 401/403/404, try to refresh cookies once
            if info_resp.status_code in [401, 403, 404]:
                self._nse_session.cookies.clear()
                self._nse_session.get(f"{base_url}/option-chain", impersonate="chrome120")
                info_resp = self._nse_session.get(contract_info_url, impersonate="chrome120")
                
            if info_resp.status_code != 200:
                print(f"[NSE Scraper] Failed to fetch contract info for {symbol}: status {info_resp.status_code}")
                return None
                
            info_data = info_resp.json()
            expiry_dates = info_data.get("expiryDates", [])
            if not expiry_dates:
                print(f"[NSE Scraper] No expiry dates found for {symbol}")
                return None
                
            # Expiry dates in info_data are in "DD-MMM-YYYY" format.
            # Convert them to "YYYY-MM-DD" for frontend compatibility and check.
            formatted_expiries = []
            today_str = datetime.today().strftime("%Y-%m-%d")
            for exp in expiry_dates:
                try:
                    dt = datetime.strptime(exp, "%d-%b-%Y")
                    fmt_exp = dt.strftime("%Y-%m-%d")
                    if fmt_exp >= today_str:
                        formatted_expiries.append((exp, fmt_exp))
                except Exception:
                    pass
            
            if not formatted_expiries:
                print(f"[NSE Scraper] No valid upcoming expiries for {symbol}")
                return None
                
            # Resolve selected expiry
            selected_exp_nse = None
            selected_exp_fmt = None
            if expiry:
                for exp_nse, exp_fmt in formatted_expiries:
                    if exp_fmt == expiry or exp_nse == expiry:
                        selected_exp_nse = exp_nse
                        selected_exp_fmt = exp_fmt
                        break
            
            if not selected_exp_nse:
                selected_exp_nse = formatted_expiries[0][0]
                selected_exp_fmt = formatted_expiries[0][1]
                
            # 3. Query the v3 option chain endpoint
            api_type = "Indices" if is_index else "Equity"
            api_url = f"{base_url}/api/option-chain-v3?type={api_type}&symbol={symbol}&expiry={selected_exp_nse}"
            
            api_resp = self._nse_session.get(api_url, impersonate="chrome120")
            if api_resp.status_code != 200:
                print(f"[NSE Scraper] Failed to fetch option chain v3 for {symbol}: status {api_resp.status_code}")
                return None
                
            data = api_resp.json()
            filtered_records = data.get("filtered", {})
            records = data.get("records", {})
            filtered_data = filtered_records.get("data", [])
            
            spot = float(records.get("underlyingValue", 0))
            if spot == 0 and filtered_data:
                first_leg = filtered_data[0]
                spot = float(first_leg.get("CE", {}).get("underlyingValue") or 
                             first_leg.get("PE", {}).get("underlyingValue") or 0)
                             
            underlying_data = {
                "symbol": symbol,
                "ticker": symbol,
                "spot": spot,
                "open": spot,
                "high": spot,
                "low": spot,
                "previous_close": spot,
                "change": 0.0,
                "pct_change": 0.0,
                "volume": 0
            }
            
            options_list = []
            total_ce_oi = 0
            total_pe_oi = 0
            
            # Calculate T and r for Greeks
            now = datetime.now()
            expiry_dt = datetime.strptime(selected_exp_fmt, "%Y-%m-%d")
            days_to_expiry = max(1, (expiry_dt - now).days)
            T = days_to_expiry / 365.0
            r = 0.065 # Indian market standard risk-free rate
            
            for item in filtered_data:
                strike = float(item["strikePrice"])
                ce_data = item.get("CE")
                pe_data = item.get("PE")
                
                parsed_ce = self._parse_nse_leg(ce_data, 'C', spot, T, r) if ce_data else None
                parsed_pe = self._parse_nse_leg(pe_data, 'P', spot, T, r) if pe_data else None
                
                if parsed_ce:
                    total_ce_oi += parsed_ce["openInterest"]
                if parsed_pe:
                    total_pe_oi += parsed_pe["openInterest"]
                    
                options_list.append({
                    "strike": strike,
                    "CE": parsed_ce,
                    "PE": parsed_pe
                })
                
            pcr = total_pe_oi / total_ce_oi if total_ce_oi > 0 else 0.0
            
            # Sort options by strike
            options_list = sorted(options_list, key=lambda x: x["strike"])
            
            if symbol.upper() in ["GOLD", "GOLDM"]:
                options_list = [o for o in options_list if round(o["strike"]) % 1000 == 0]
            elif symbol.upper() in ["SILVER", "SILVERM"]:
                options_list = [o for o in options_list if round(o["strike"]) % 1000 == 0]
            
            # Filter options +/- 15% around spot
            options_list = [o for o in options_list if spot * 0.85 <= o["strike"] <= spot * 1.15]
            
            return {
                "underlying": underlying_data,
                "expiry_dates": [item[1] for item in formatted_expiries][:10],
                "selected_expiry": selected_exp_fmt,
                "pcr": round(pcr, 4),
                "options": options_list
            }
        except Exception as e:
            print(f"[NSE Scraper] Scraping NSE failed: {str(e)}")
            return None

    def _parse_nse_leg(self, leg: dict, option_type: str, spot: float, T: float, r: float) -> dict:
        strike = float(leg.get("strikePrice", 0))
        ltp = float(leg.get("lastPrice", 0))
        
        # Support both old and new keys for bid/ask
        bid = float(leg.get("bidprice") or leg.get("buyPrice1") or 0)
        ask = float(leg.get("askPrice") or leg.get("sellPrice1") or 0)
        
        change = float(leg.get("change", 0))
        pct_change = float(leg.get("pChange", 0))
        volume = int(leg.get("totalTradedVolume", 0))
        oi = int(leg.get("openInterest", 0))
        oi_change = int(leg.get("changeinOpenInterest", 0))
        iv = float(leg.get("impliedVolatility", 0)) / 100.0 # NSE lists IV as percent

        # OI Analysis
        # Long Buildup: Price up, OI up
        # Short Buildup: Price down, OI up
        # Long Liquidation: Price down, OI down
        # Short Covering: Price up, OI down
        oi_analysis = "Neutral"
        if change > 0 and oi_change > 0:
            oi_analysis = "Long Buildup"
        elif change < 0 and oi_change > 0:
            oi_analysis = "Short Buildup"
        elif change < 0 and oi_change < 0:
            oi_analysis = "Long Liquidation"
        elif change > 0 and oi_change < 0:
            oi_analysis = "Short Covering"

        # Calculate Delta
        try:
            greeks = bs_greeks(spot, strike, T, r, iv, option_type)
            delta = float(greeks.get("delta") or 0.0)
        except Exception:
            delta = 0.5 if option_type == 'C' else -0.5

        return {
            "strike": strike,
            "optionType": option_type,
            "lastPrice": ltp,
            "bid": bid,
            "ask": ask,
            "change": change,
            "pctChange": pct_change,
            "volume": volume,
            "openInterest": oi,
            "impliedVolatility": iv,
            "oiAnalysis": oi_analysis,
            "delta": delta,
            "bidQty": 0.0,
            "askQty": 0.0,
            "bidIv": iv,
            "askIv": ask
        }

    def _generate_mock_underlying(self, symbol: str) -> dict:
        # Standard default mock prices for popular symbols
        defaults = {
            "NIFTY": 23500.0,
            "BANKNIFTY": 51500.0,
            "NIFTYIT": 38500.0,
            "SPY": 540.0,
            "AAPL": 180.0,
            "MSFT": 420.0,
            "TSLA": 175.0,
            "SBIN": 840.0,
            "ITC": 430.0,
            "RELIANCE": 2950.0
        }
        symbol_clean = self._clean_symbol(symbol)
        spot = defaults.get(symbol_clean, 100.0)
        # Add a tiny random oscillation to simulate active markets
        spot = spot * (1.0 + (random.random() - 0.5) * 0.002)
        change = (random.random() - 0.45) * spot * 0.01
        prev_close = spot - change
        
        return {
            "symbol": symbol.upper(),
            "ticker": symbol_clean,
            "spot": round(spot, 2),
            "open": round(spot - (random.random() - 0.5) * 2, 2),
            "high": round(spot + abs(random.random() * 5), 2),
            "low": round(spot - abs(random.random() * 5), 2),
            "previous_close": round(prev_close, 2),
            "change": round(change, 2),
            "pct_change": round((change / prev_close) * 100, 2),
            "volume": random.randint(100000, 5000000)
        }

    def _generate_mock_option_chain(self, symbol: str, expiry: str = None) -> dict:
        """
        Creates a high-fidelity, mathematically consistent mock options chain centered
        around the synthetic spot price. Keeps the UI perfectly operational.
        """
        symbol_clean = self._clean_symbol(symbol)
            
        underlying = self.get_underlying_data(symbol)
        spot = underlying["spot"]
        
        # Select expiries (using scrip master if available, otherwise programmatically calculated fallback)
        expiries = self._get_valid_expiries(symbol_clean)
        selected_expiry = expiry if expiry in expiries else expiries[0]
        
        today = datetime.now()
        expiry_dt = datetime.strptime(selected_expiry, "%Y-%m-%d")
        days_to_expiry = max(1, (expiry_dt - today).days)
        T = days_to_expiry / 365.0
        
        # Calibrate risk-free rate (6.5% for Indian markets, 5.0% for US)
        is_india = symbol_clean in NSE_FO_STOCKS or symbol_clean in [
            "NIFTY", "BANKNIFTY", "SENSEX", "FINNIFTY", "MIDCPNIFTY", "NIFTYIT", "NIFTYCPSE", 
            "GOLD", "GOLDM", "SILVER", "SILVERM", "CRUDEOIL", "CRUDEOILM", "NATURALGAS", "NATGASMINI"
        ]
        r = 0.065 if is_india else 0.05
        
        # Set strike step depending on index, stock, or commodity
        if symbol_clean in ["GOLD", "GOLDM"]:
            step = 1000
        elif symbol_clean in ["SILVER", "SILVERM"]:
            step = 1000
        elif spot > 10000:
            step = 100
        elif spot > 1000:
            step = 50
        elif spot > 500:
            step = 10
        elif spot > 100:
            step = 5
        else:
            step = 1

        # Center strikes around ATM
        atm_strike = round(spot / step) * step
        num_strikes = 15
        strikes = [atm_strike + i * step for i in range(-num_strikes, num_strikes + 1)]

        options_list = []
        total_ce_oi = 0
        total_pe_oi = 0

        # Base Volatility (IV) - Dynamically query and cache real-time VIX or use commodity defaults
        now_time = datetime.now()
        
        # Determine base IV default and VIX ticker key
        if symbol_clean in ["GOLD", "GOLDM"]:
            default_base_iv = 0.16
            vix_key = "^GVZ" # CBOE Gold Volatility Index
        elif symbol_clean in ["SILVER", "SILVERM"]:
            default_base_iv = 0.22
            vix_key = "^VXSLV" # CBOE Silver Volatility Index
        elif symbol_clean in ["CRUDEOIL", "CRUDEOILM"]:
            default_base_iv = 0.38
            vix_key = "^OVX" # CBOE Crude Oil Volatility Index
        elif symbol_clean in ["NATURALGAS", "NATGASMINI"]:
            default_base_iv = 0.52
            vix_key = None
        elif symbol_clean in ["SPY", "AAPL", "MSFT", "TSLA"]:
            default_base_iv = 0.16
            vix_key = "^VIX"
        else:
            default_base_iv = 0.135
            vix_key = "^INDIAVIX"
            
        if not hasattr(self, "_vix_cache"):
            self._vix_cache = {}
            self._vix_cache_time = {}
            
        cached_val = self._vix_cache.get(vix_key) if vix_key else None
        cached_time = self._vix_cache_time.get(vix_key) if vix_key else None
        
        if cached_val and cached_time and (now_time - cached_time).total_seconds() < 600:
            base_iv = cached_val
        else:
            base_iv = default_base_iv
            if vix_key:
                try:
                    vix_ticker = yf.Ticker(vix_key)
                    vix_hist = vix_ticker.history(period="1d")
                    if not vix_hist.empty:
                        base_iv = float(vix_hist['Close'].iloc[-1]) / 100.0
                    else:
                        vix_info = vix_ticker.info
                        val = vix_info.get("regularMarketPrice") or vix_info.get("previousClose")
                        if val:
                            base_iv = float(val) / 100.0
                    self._vix_cache[vix_key] = base_iv
                    self._vix_cache_time[vix_key] = now_time
                    print(f"[Simulation Calibration] Calibrated and cached base IV for {vix_key}: {base_iv*100:.2f}%")
                except Exception as e:
                    print(f"[Simulation Calibration] Failed to fetch {vix_key}, using fallback: {base_iv*100:.2f}%. Error: {str(e)}")

        for s in strikes:
            # Implied Volatility skew (smile) - calibrated continuous model to match real index option pricing
            dist_pct = (s - spot) / spot
            iv = base_iv - 0.65 * dist_pct + 0.40 * (dist_pct ** 2)
            iv = max(0.01, iv)

            # Theoretical prices via Black-Scholes
            ce_price = bs_pricing(spot, s, T, r, iv, 'C')
            pe_price = bs_pricing(spot, s, T, r, iv, 'P')

            # Build realistic Bid/Ask spreads (0.5% - 2%)
            spread_ce = max(0.05, ce_price * 0.01)
            spread_pe = max(0.05, pe_price * 0.01)

            bid_ce = max(0.0, ce_price - spread_ce / 2)
            ask_ce = ce_price + spread_ce / 2
            bid_pe = max(0.0, pe_price - spread_pe / 2)
            ask_pe = pe_price + spread_pe / 2

            # Open Interest generation (peaking at ATM and key round numbers)
            oi_multiplier = 10000 / (1 + (abs(s - spot) / spot) * 15)
            # Add premium to round strikes
            if s % (step * 2) == 0:
                oi_multiplier *= 1.8
            
            oi_ce = int(oi_multiplier * (0.5 + random.random()))
            oi_pe = int(oi_multiplier * (0.5 + random.random()))
            total_ce_oi += oi_ce
            total_pe_oi += oi_pe

            # Daily changes
            oi_change_ce = int(oi_ce * (random.random() - 0.4) * 0.1)
            oi_change_pe = int(oi_pe * (random.random() - 0.4) * 0.1)

            change_ce = (random.random() - 0.5) * ce_price * 0.1
            change_pe = (random.random() - 0.5) * pe_price * 0.1

            # Analysis labels
            def get_analysis(price_chg, oi_chg):
                if price_chg > 0 and oi_chg > 0: return "Long Buildup"
                elif price_chg < 0 and oi_chg > 0: return "Short Buildup"
                elif price_chg < 0 and oi_chg < 0: return "Long Liquidation"
                elif price_chg > 0 and oi_chg < 0: return "Short Covering"
                return "Neutral"

            # Calculate Delta for mock options
            try:
                g_ce = bs_greeks(spot, s, T, r, iv, 'C')
                g_pe = bs_greeks(spot, s, T, r, iv, 'P')
                delta_ce = round(float(g_ce.get("delta") or 0.0), 3)
                delta_pe = round(float(g_pe.get("delta") or 0.0), 3)
            except Exception:
                delta_ce = 0.5
                delta_pe = -0.5

            options_list.append({
                "strike": s,
                "CE": {
                    "strike": s,
                    "optionType": "C",
                    "lastPrice": round(ce_price, 2),
                    "bid": round(bid_ce, 2),
                    "ask": round(ask_ce, 2),
                    "change": round(change_ce, 2),
                    "pctChange": round((change_ce / ce_price * 100) if ce_price > 0 else 0, 2),
                    "volume": random.randint(1000, 50000),
                    "openInterest": oi_ce,
                    "impliedVolatility": round(iv, 4),
                    "oiAnalysis": get_analysis(change_ce, oi_change_ce),
                    "delta": delta_ce,
                    "bidQty": 0.0,
                    "askQty": 0.0,
                    "bidIv": round(iv, 4),
                    "askIv": round(iv, 4)
                },
                "PE": {
                    "strike": s,
                    "optionType": "P",
                    "lastPrice": round(pe_price, 2),
                    "bid": round(bid_pe, 2),
                    "ask": round(ask_pe, 2),
                    "change": round(change_pe, 2),
                    "pctChange": round((change_pe / pe_price * 100) if pe_price > 0 else 0, 2),
                    "volume": random.randint(1000, 50000),
                    "openInterest": oi_pe,
                    "impliedVolatility": round(iv, 4),
                    "oiAnalysis": get_analysis(change_pe, oi_change_pe),
                    "delta": delta_pe,
                    "bidQty": 0.0,
                    "askQty": 0.0,
                    "bidIv": round(iv, 4),
                    "askIv": round(iv, 4)
                }
            })

        pcr = total_pe_oi / total_ce_oi if total_ce_oi > 0 else 0.0

        return {
            "underlying": underlying,
            "expiry_dates": expiries,
            "selected_expiry": selected_expiry,
            "pcr": round(pcr, 4),
            "options": options_list
        }

    def _get_dhan_scrip_info(self, symbol: str) -> dict:
        """
        Dynamically resolves the Dhan Security ID and Segment for a symbol.
        Uses a local cache or downloads Dhan's compact scrip master CSV.
        """
        symbol_clean = self._clean_symbol(symbol)
        
        # Hardcoded quick lookup for standard indexes and stocks
        quick_map = {
            "NIFTY": {"security_id": "13", "segment": "IDX_I", "name": "Nifty 50"},
            "BANKNIFTY": {"security_id": "25", "segment": "IDX_I", "name": "Nifty Bank"},
            "SENSEX": {"security_id": "51", "segment": "IDX_I", "name": "BSE SENSEX"},
            "FINNIFTY": {"security_id": "27", "segment": "IDX_I", "name": "Nifty Financial Services"},
            "MIDCPNIFTY": {"security_id": "50", "segment": "IDX_I", "name": "Nifty Midcap Select"},
            "SBIN": {"security_id": "3045", "segment": "NSE_EQ", "name": "State Bank of India"},
            "ITC": {"security_id": "1660", "segment": "NSE_EQ", "name": "ITC Limited"},
            "RELIANCE": {"security_id": "2885", "segment": "NSE_EQ", "name": "Reliance Industries"},
            "HDFCBANK": {"security_id": "1333", "segment": "NSE_EQ", "name": "HDFC Bank"},
            "INFY": {"security_id": "1594", "segment": "NSE_EQ", "name": "Infosys"},
            "TCS": {"security_id": "11536", "segment": "NSE_EQ", "name": "Tata Consultancy Services"}
        }
        
        if not hasattr(self, "_dhan_scrip_cache"):
            self._dhan_scrip_cache = {}
            self._dhan_expiries_cache = {}
            self._dhan_options_cache = {}
            try:
                print("[Dhan API] Downloading Dhan Scrip Master to resolve new symbols...")
                url = "https://images.dhan.co/api-data/api-scrip-master.csv"
                resp = httpx.get(url, timeout=15.0)
                if resp.status_code == 200:
                    import csv
                    from io import StringIO
                    csv_data = StringIO(resp.text)
                    reader = csv.DictReader(csv_data)
                    for row in reader:
                        sym = row.get("SEM_TRADING_SYMBOL", "").upper()
                        base_sym = sym.split("-")[0].split(" ")[0]
                        sec_id = row.get("SEM_SMST_SECURITY_ID")
                        seg = row.get("SEM_SEGMENT")
                        # Map short codes to Dhan API segment strings
                        if seg == "I": seg = "IDX_I"
                        elif seg == "D": seg = "BSE_FNO"
                        elif seg == "F": seg = "NSE_FNO"
                        elif seg == "M": seg = "MCX_COMM"
                        elif seg == "E": seg = "NSE_EQ"
                        name = row.get("SEM_CUSTOM_SYMBOL")
                        
                        if base_sym and sec_id and seg:
                            if base_sym not in self._dhan_scrip_cache:
                                self._dhan_scrip_cache[base_sym] = {
                                    "security_id": sec_id,
                                    "segment": seg,
                                    "name": name
                                }
                            
                            # Cache options contracts
                            opt_type = row.get("SEM_OPTION_TYPE")
                            strike_str = row.get("SEM_STRIKE_PRICE")
                            expiry_date = row.get("SEM_EXPIRY_DATE")
                            if opt_type in ["CE", "PE"] and strike_str and expiry_date:
                                try:
                                    strike = float(strike_str)
                                    exp_str = expiry_date.split(" ")[0]
                                    self._dhan_options_cache[(base_sym, strike, opt_type, exp_str)] = sec_id
                                except ValueError:
                                    pass
                                
                            # Collect expiries
                            if expiry_date and expiry_date != "0001-01-01":
                                exp_str = expiry_date.split(" ")[0]
                                try:
                                    # Filter out past expiries for cleanliness
                                    dt = datetime.strptime(exp_str, "%Y-%m-%d")
                                    if dt >= datetime.today().replace(hour=0, minute=0, second=0, microsecond=0):
                                        if base_sym not in self._dhan_expiries_cache:
                                            self._dhan_expiries_cache[base_sym] = set()
                                        self._dhan_expiries_cache[base_sym].add(exp_str)
                                except ValueError:
                                    pass
                print(f"[Dhan API] Loaded {len(self._dhan_scrip_cache)} symbols and {len(self._dhan_options_cache)} option contracts from Dhan Scrip Master.")
            except Exception as e:
                print(f"[Dhan API] Error downloading Dhan scrip master: {str(e)}")
                
        if symbol_clean in quick_map:
            return quick_map[symbol_clean]
            
        return self._dhan_scrip_cache.get(symbol_clean)

    def get_dhan_option_security_id(self, symbol: str, strike: float, option_type: str, expiry: str) -> str:
        symbol_clean = self._clean_symbol(symbol)
        
        # Ensure scrip master is loaded
        if not hasattr(self, "_dhan_options_cache"):
            self._get_dhan_scrip_info(symbol_clean)
            
        opt_type = "CE" if option_type == "C" else "PE" if option_type == "P" else option_type
        key = (symbol_clean, float(strike), opt_type, expiry)
        return self._dhan_options_cache.get(key)

    def _get_valid_expiries(self, symbol: str) -> list:
        """
        Helper to return real expiries from NSE or programmatic fallback Tuesdays/Thursdays.
        """
        symbol_clean = self._clean_symbol(symbol)

        try:
            nse_chain = self._try_scrape_nse(symbol_clean)
            if nse_chain and nse_chain.get("expiry_dates"):
                return nse_chain["expiry_dates"]
        except Exception:
            pass
            
        # Try to retrieve from Dhan scrip master expiries cache
        if not hasattr(self, "_dhan_scrip_cache"):
            self._get_dhan_scrip_info(symbol_clean)
            
        if hasattr(self, "_dhan_expiries_cache") and symbol_clean in self._dhan_expiries_cache:
            exp_set = self._dhan_expiries_cache[symbol_clean]
            today_str = datetime.today().strftime("%Y-%m-%d")
            valid_set = {e for e in exp_set if e >= today_str}
            if valid_set:
                return sorted(list(valid_set))[:10]
            
        expiries = []
        today = datetime.now()
        
        if symbol_clean in ["SPY", "AAPL", "MSFT", "TSLA"]:
            weekday_target = 4 # Friday
        elif symbol_clean in ["FINNIFTY", "NIFTY", "BANKNIFTY"]:
            weekday_target = 1 # Tuesday (Nifty weekly/monthly and Bank Nifty monthly expiries shifted to Tuesdays in late 2025/2026)
        elif symbol_clean == "MIDCPNIFTY":
            weekday_target = 0 # Monday
        elif symbol_clean == "SENSEX":
            weekday_target = 3 # Thursday (BSE weekly Sensex expiries)
        else:
            weekday_target = 3 # Thursday (Stocks, Commodities default)
            
        # Determine the first expiry day offset (skipping today if past market close)
        first_expiry_offset = (weekday_target - today.weekday()) % 7
        if first_expiry_offset == 0:
            is_commodity = symbol_clean in ["GOLD", "GOLDM", "SILVER", "SILVERM", "CRUDEOIL", "CRUDEOILM", "NATURALGAS", "NATGASMINI"]
            if is_commodity:
                # MCX Commodities options close at 23:30 (11:30 PM)
                if today.hour > 23 or (today.hour == 23 and today.minute >= 30):
                    first_expiry_offset = 7
            else:
                # Equity and Indices options close at 15:30 (3:30 PM)
                if today.hour > 15 or (today.hour == 15 and today.minute >= 30):
                    first_expiry_offset = 7
                
        for i in range(10):
            expiry_date = today + timedelta(days=first_expiry_offset + i * 7)
            expiries.append(expiry_date.strftime("%Y-%m-%d"))
            
        return expiries

    def _parse_dhan_leg(self, leg: dict, strike: float, option_type: str) -> dict:
        if not leg:
            return None
            
        iv = float(leg.get("implied_volatility", 0.0)) / 100.0
        ltp = float(leg.get("last_price", 0.0))
        prev_close = float(leg.get("previous_close_price", ltp))
        change = ltp - prev_close
        pct_change = (change / prev_close * 100.0) if prev_close > 0 else 0.0
        
        oi = int(leg.get("oi", 0))
        prev_oi = int(leg.get("previous_oi", oi))
        oi_change = oi - prev_oi
        
        oi_analysis = "Neutral"
        if change > 0 and oi_change > 0:
            oi_analysis = "Long Buildup"
        elif change < 0 and oi_change > 0:
            oi_analysis = "Short Buildup"
        elif change < 0 and oi_change < 0:
            oi_analysis = "Long Liquidation"
        elif change > 0 and oi_change < 0:
            oi_analysis = "Short Covering"
            
        return {
            "strike": strike,
            "optionType": option_type,
            "lastPrice": ltp,
            "bid": ltp * 0.999,
            "ask": ltp * 1.001,
            "change": round(change, 2),
            "pctChange": round(pct_change, 2),
            "volume": int(leg.get("previous_volume", 0)),
            "openInterest": oi,
            "impliedVolatility": round(iv, 4),
            "oiAnalysis": oi_analysis
        }

    def get_historical_intraday_candles(self, symbol: str, interval: int = 5, from_date: str = None, to_date: str = None) -> list:
        """
        Retrieves historical intraday spot prices (candles) for a given symbol.
        First tries Dhan API's intraday historical charts (supporting up to 5 years).
        Falls back to Yahoo Finance's intraday charts (limited to past 30-60 days).
        Caches the data locally in JSON format to avoid hitting rate limits.
        """
        symbol_clean = self._clean_symbol(symbol)

        # 1. Check local cache first
        cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db")
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, f"intraday_cache_{symbol_clean}_{interval}_{from_date}_{to_date}.json")
        
        if os.path.exists(cache_file):
            try:
                import json
                with open(cache_file, "r") as f:
                    cached_data = json.load(f)
                print(f"[Intraday Cache] Loaded {len(cached_data)} candles from cache for {symbol_clean}")
                return cached_data
            except Exception as e:
                print(f"[Intraday Cache] Failed to load cache: {e}")

        candles = []

        # 2. Try Dhan API if enabled
        if self.is_dhan_enabled:
            scrip_info = self._get_dhan_scrip_info(symbol_clean)
            if scrip_info:
                try:
                    sec_id = scrip_info["security_id"]
                    segment = scrip_info["segment"]
                    # Map segment and instrument
                    api_seg = "MCX_COMM" if segment == "M" else segment
                    inst_type = "INDEX" if segment == "IDX_I" else "EQUITY"
                    
                    print(f"[Dhan API] Fetching historical intraday {interval}m data for {symbol_clean} ({from_date} to {to_date})...")
                    resp = self.dhan.intraday_minute_data(
                        security_id=sec_id,
                        exchange_segment=api_seg,
                        instrument_type=inst_type,
                        from_date=from_date,
                        to_date=to_date,
                        interval=interval
                    )
                    
                    if resp and resp.get("status") == "success":
                        raw_candles = resp.get("data", {}).get("candles", [])
                        print(f"[Dhan API] Successfully fetched {len(raw_candles)} candles.")
                        for rc in raw_candles:
                            try:
                                if isinstance(rc[0], (int, float)):
                                    dt = datetime.fromtimestamp(rc[0])
                                else:
                                    dt = pd.to_datetime(rc[0])
                                
                                candles.append({
                                    "timestamp": dt.strftime("%Y-%m-%d %H:%M:%S"),
                                    "open": float(rc[1]),
                                    "high": float(rc[2]),
                                    "low": float(rc[3]),
                                    "close": float(rc[4]),
                                    "volume": int(rc[5]) if len(rc) > 5 else 0
                                })
                            except Exception as e:
                                print(f"[Dhan API] Error parsing candle: {e}")
                except Exception as e:
                    print(f"[Dhan API] Intraday fetch failed, falling back to Yahoo: {e}")

        # 3. Fallback to Yahoo Finance if candles is empty
        if not candles:
            ticker_symbol = SYMBOL_MAPPING.get(symbol_clean, symbol_clean)
            print(f"[Yahoo Finance] Downloading intraday {interval}m data for {ticker_symbol} ({from_date} to {to_date})...")
            try:
                df = yf.download(ticker_symbol, start=from_date, end=to_date, interval=f"{interval}m")
                if not df.empty:
                    if isinstance(df.columns, pd.MultiIndex):
                        df.columns = df.columns.get_level_values(0)
                        
                    multiplier = 1.0
                    is_commodity = symbol_clean in ["GOLD", "GOLDM", "SILVER", "SILVERM", "CRUDEOIL", "CRUDEOILM", "NATURALGAS", "NATGASMINI"]
                    if is_commodity:
                        usd_inr = 83.5
                        if symbol_clean in ["CRUDEOIL", "CRUDEOILM"]:
                            multiplier = usd_inr
                        elif symbol_clean in ["NATURALGAS", "NATGASMINI"]:
                            multiplier = usd_inr
                        elif symbol_clean in ["GOLD", "GOLDM"]:
                            multiplier = ((usd_inr * 10) / 31.1035) * 1.314
                        elif symbol_clean in ["SILVER", "SILVERM"]:
                            multiplier = ((usd_inr * 1000) / 31.1035) * 1.324

                    for dt, row in df.iterrows():
                        candles.append({
                            "timestamp": dt.strftime("%Y-%m-%d %H:%M:%S"),
                            "open": float(row["Open"]) * multiplier,
                            "high": float(row["High"]) * multiplier,
                            "low": float(row["Low"]) * multiplier,
                            "close": float(row["Close"]) * multiplier,
                            "volume": int(row["Volume"]) if "Volume" in row and not pd.isna(row["Volume"]) else 0
                        })
                    print(f"[Yahoo Finance] Downloaded {len(candles)} candles.")
            except Exception as e:
                print(f"[Yahoo Finance] Download failed: {e}")

        # 4. Save to cache if we got candles
        if candles:
            try:
                import json
                with open(cache_file, "w") as f:
                    json.dump(candles, f)
            except Exception as e:
                print(f"[Intraday Cache] Failed to write cache: {e}")
                
        return candles

    def get_ticker_prices(self) -> dict:
        import time
        now = time.time()
        if hasattr(self, "_ticker_prices_cache") and self._ticker_prices_cache and (now - self._ticker_prices_cache_time < 60.0):
            return self._ticker_prices_cache

        tickers_mapping = {
            "Nifty 50": "^NSEI",
            "Bank Nifty": "^NSEBANK",
            "Reliance": "RELIANCE.NS",
            "State Bank": "SBIN.NS",
            "ITC Limited": "ITC.NS",
            "Bitcoin": "BTC-USD",
            "Ethereum": "ETH-USD",
            "Solana": "SOL-USD",
            "S&P 500": "^GSPC",
            "Nasdaq": "^IXIC",
            "Apple": "AAPL",
            "Tesla": "TSLA"
        }

        results = []
        try:
            symbols = list(tickers_mapping.values())
            import yfinance as yf
            df = yf.download(symbols, period="5d", interval="1d", progress=False)
            if not df.empty:
                for name, ticker in tickers_mapping.items():
                    try:
                        import pandas as pd
                        if isinstance(df.columns, pd.MultiIndex):
                            close_col = df['Close'][ticker]
                        else:
                            close_col = df['Close']
                        
                        close_vals = close_col.dropna().tolist()
                        if len(close_vals) >= 2:
                            last = float(close_vals[-1])
                            prev = float(close_vals[-2])
                            change = float(((last - prev) / prev) * 100.0)
                        elif len(close_vals) == 1:
                            last = float(close_vals[0])
                            change = 0.0
                        else:
                            last = 0.0
                            change = 0.0

                        results.append({
                            "name": name,
                            "symbol": ticker,
                            "price": last,
                            "change": change
                        })
                    except Exception as te:
                        print(f"Error parsing ticker {ticker}: {str(te)}")
        except Exception as e:
            print(f"Error downloading tickers from yfinance: {str(e)}")

        if results:
            self._ticker_prices_cache = {"tickers": results}
            self._ticker_prices_cache_time = now
            return self._ticker_prices_cache

        return {"tickers": []}

