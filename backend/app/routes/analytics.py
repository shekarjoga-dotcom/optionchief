from fastapi import APIRouter, HTTPException, Query
from app.services.market_data import MarketDataService
from app.quant.volatility import calculate_volatility_cone, calculate_historical_volatility

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
market_service = MarketDataService()

@router.get("/volatility-cone")
def get_volatility_cone(symbol: str = Query(..., description="Underlying symbol (e.g. NIFTY, AAPL)")):
    try:
        prices = market_service.get_historical_prices(symbol)
        cone = calculate_volatility_cone(prices)
        
        # Add current Implied Volatilities of near term expiries to chart overlay
        chain_data = market_service.get_option_chain(symbol)
        
        # Calculate current ATM Implied Volatility
        options = chain_data.get("options", [])
        spot = chain_data.get("underlying", {}).get("spot", 100.0)
        
        # Find ATM strike
        atm_iv = 15.0 # default 15%
        if options:
            closest_strike = min(options, key=lambda x: abs(x["strike"] - spot))
            ce_iv = closest_strike.get("CE", {}).get("impliedVolatility", 0.15) if closest_strike.get("CE") else 0.15
            pe_iv = closest_strike.get("PE", {}).get("impliedVolatility", 0.15) if closest_strike.get("PE") else 0.15
            # Convert decimal to percent
            atm_iv = float((ce_iv + pe_iv) / 2.0 * 100.0)

        # Build output structure
        return {
            "symbol": symbol.upper(),
            "spot": spot,
            "current_iv": round(atm_iv, 2),
            "cone": cone
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating volatility cone: {str(e)}")

@router.get("/historical-volatility")
def get_historical_volatility(symbol: str = Query(..., description="Underlying symbol")):
    try:
        prices = market_service.get_historical_prices(symbol)
        hv = calculate_historical_volatility(prices, window=30)
        return {
            "symbol": symbol.upper(),
            "historical_volatility_30d": round(hv * 100.0, 2) # as percentage
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating historical volatility: {str(e)}")
