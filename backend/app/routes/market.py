from fastapi import APIRouter, HTTPException, Query
from app.services.market_data import MarketDataService

router = APIRouter(prefix="/api/market", tags=["market"])
market_service = MarketDataService()

@router.get("/underlying")
def get_underlying(symbol: str = Query(..., description="Underlying symbol (e.g. NIFTY, AAPL, SPY)")):
    try:
        data = market_service.get_underlying_data(symbol)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching underlying data: {str(e)}")

@router.get("/option-chain")
def get_option_chain(
    symbol: str = Query(..., description="Underlying symbol (e.g. NIFTY, AAPL, SPY)"),
    expiry: str = Query(None, description="Expiry date in YYYY-MM-DD format")
):
    try:
        data = market_service.get_option_chain(symbol, expiry)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching option chain: {str(e)}")

@router.get("/ticker-prices")
def get_ticker_prices():
    try:
        data = market_service.get_ticker_prices()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching ticker prices: {str(e)}")

def get_fallback_news():
    return [
        {"title": "Indian stock markets trade flat ahead of global rate decisions", "source": "FinanceNews", "time": "Just now"},
        {"title": "Nifty holds above 23,800 level; banking shares lead recovery", "source": "MarketWatch", "time": "1 hour ago"},
        {"title": "Reliance Industries expands retail footprint with new digital ventures", "source": "BizTimes", "time": "2 hours ago"},
        {"title": "Global crude oil prices slide on rising inventory and demand forecasts", "source": "EnergyHub", "time": "3 hours ago"},
        {"title": "Gold reaches record high as investors seek safe haven assets", "source": "BullionReport", "time": "4 hours ago"},
        {"title": "Tech stocks rally as positive earnings surprise analysts", "source": "TechDigest", "time": "5 hours ago"}
    ]

@router.get("/news")
def get_business_news():
    import xml.etree.ElementTree as ET
    import httpx
    try:
        url = "https://news.google.com/rss/search?q=business+stocks+finance+india&hl=en-IN&gl=IN&ceid=IN:en"
        response = httpx.get(url, timeout=5.0)
        if response.status_code != 200:
            return {"status": "success", "news": get_fallback_news()}
            
        root = ET.fromstring(response.content)
        items = root.findall(".//item")
        
        news_list = []
        for item in items[:15]:
            title = item.find("title").text if item.find("title") is not None else ""
            source_el = item.find("source")
            source = source_el.text if source_el is not None else "News"
            pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
            
            if " - " in title:
                title = title.rsplit(" - ", 1)[0]
                
            news_list.append({
                "title": title,
                "source": source,
                "time": pub_date
            })
            
        return {"status": "success", "news": news_list}
    except Exception as e:
        print(f"[News API] Error fetching RSS: {e}")
        return {"status": "success", "news": get_fallback_news()}
