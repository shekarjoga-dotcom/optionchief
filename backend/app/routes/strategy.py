import secrets
import json
import base64
import urllib.parse
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import sqlite3

router = APIRouter(prefix="/api/strategy", tags=["strategy"])

DB_PATH = "backend/data/options_oracle.db"

def init_strategy_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS shared_strategies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                short_code TEXT UNIQUE NOT NULL,
                symbol TEXT NOT NULL,
                expiry TEXT,
                strategy_name TEXT,
                legs_json TEXT NOT NULL,
                metrics_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Strategy DB Init Error]: {e}")

init_strategy_db()

class StrategyLegSchema(BaseModel):
    strike: float
    optionType: str  # 'C' or 'P' or 'CE' or 'PE'
    action: str      # 'BUY' or 'SELL'
    lots: int
    entryPrice: Optional[float] = 0.0

class ShareStrategySchema(BaseModel):
    symbol: str
    expiry: Optional[str] = ""
    strategyName: Optional[str] = "OptionChief Strategy"
    legs: List[StrategyLegSchema]
    maxPayoff: Optional[float] = 0.0
    maxRisk: Optional[float] = 0.0
    margin: Optional[float] = 0.0

@router.post("/share")
def create_shared_strategy(payload: ShareStrategySchema):
    try:
        short_code = secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:7]
        legs_data = [leg.dict() for leg in payload.legs]
        metrics_data = {
            "maxPayoff": payload.maxPayoff,
            "maxRisk": payload.maxRisk,
            "margin": payload.margin
        }
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO shared_strategies (short_code, symbol, expiry, strategy_name, legs_json, metrics_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                short_code,
                payload.symbol.upper(),
                payload.expiry,
                payload.strategyName,
                json.dumps(legs_data),
                json.dumps(metrics_data)
            )
        )
        conn.commit()
        conn.close()
        
        share_url = f"https://optionchief.in/s/{short_code}"
        
        # Build 1-click broker entry links
        broker_links = build_broker_links(payload.symbol.upper(), payload.expiry, legs_data)
        
        return {
            "status": "success",
            "shortCode": short_code,
            "shareUrl": share_url,
            "brokerLinks": broker_links
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to share strategy: {str(e)}")

@router.get("/share/{short_code}")
def get_shared_strategy(short_code: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "SELECT short_code, symbol, expiry, strategy_name, legs_json, metrics_json, created_at FROM shared_strategies WHERE short_code = ?",
            (short_code,)
        )
        row = c.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Shared strategy link expired or not found")
            
        legs = json.loads(row[4])
        metrics = json.loads(row[5]) if row[5] else {}
        broker_links = build_broker_links(row[1], row[2], legs)
        
        return {
            "shortCode": row[0],
            "symbol": row[1],
            "expiry": row[2],
            "strategyName": row[3],
            "legs": legs,
            "metrics": metrics,
            "createdAt": row[6],
            "brokerLinks": broker_links
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving strategy: {str(e)}")

def build_broker_links(symbol: str, expiry: str, legs: list) -> dict:
    """
    Generates 1-Click Entry Links for Dhan, Zerodha Kite, and Kotak Neo.
    """
    symbol_clean = symbol.upper()
    
    # 1. Zerodha Kite Publisher Basket Link
    # Format: https://kite.trade/connect/basket
    kite_basket = []
    lot_size = 75 if symbol_clean in ["NIFTY", "ALL_NSE"] else 30 if symbol_clean == "BANKNIFTY" else 65 if symbol_clean == "FINNIFTY" else 10 if symbol_clean == "SENSEX" else 50
    
    for leg in legs:
        opt_type = "CE" if leg["optionType"] in ["C", "CE"] else "PE"
        qty = leg["lots"] * lot_size
        trading_symbol = f"{symbol_clean}{strike_fmt(leg['strike'])}{opt_type}"
        kite_basket.append({
            "variety": "regular",
            "tradingsymbol": trading_symbol,
            "exchange": "NFO" if symbol_clean != "SENSEX" else "BFO",
            "transaction_type": leg["action"].upper(),
            "order_type": "MARKET",
            "quantity": qty,
            "product": "NRML"
        })
        
    kite_json = json.dumps(kite_basket)
    kite_url = f"https://kite.trade/connect/basket?data={urllib.parse.quote(kite_json)}"
    
    # 2. Dhan HQ Express Basket Link
    # Format: Base64 / URL encoded Dhan Basket Link
    dhan_basket = {
        "basket_name": f"OptionChief {symbol_clean} Strategy",
        "orders": []
    }
    for leg in legs:
        opt_type = "CE" if leg["optionType"] in ["C", "CE"] else "PE"
        qty = leg["lots"] * lot_size
        dhan_basket["orders"].append({
            "symbol": f"{symbol_clean} {leg['strike']} {opt_type}",
            "exchange_segment": "NSE_FNO" if symbol_clean != "SENSEX" else "BSE_FNO",
            "transaction_type": leg["action"].upper(),
            "quantity": qty,
            "product_type": "MARGIN",
            "order_type": "MARKET"
        })
    dhan_b64 = base64.b64encode(json.dumps(dhan_basket).encode()).decode()
    dhan_url = f"https://options.dhan.co/basket?data={dhan_b64}"
    
    # 3. Kotak Neo Basket Link
    kotak_url = f"https://neo.kotaksecurities.com/basket?data={urllib.parse.quote(json.dumps(dhan_basket))}"
    
    return {
        "dhanUrl": dhan_url,
        "kiteUrl": kite_url,
        "kotakUrl": kotak_url,
        "kiteBasketJson": kite_json
    }

def strike_fmt(strike: float) -> str:
    s = str(int(strike)) if strike.is_integer() else str(strike)
    return s
