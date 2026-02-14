import logging
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Stock Trading Game API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _safe(value, default=None):
    """Return *default* when *value* is None or NaN."""
    if value is None:
        return default
    try:
        if value != value:  # NaN check
            return default
    except (TypeError, ValueError):
        pass
    return value


def _build_summary(ticker: yf.Ticker, symbol: str) -> dict:
    """Build a compact stock summary dict for a single ticker."""
    info = ticker.info or {}

    price = _safe(info.get("currentPrice")) or _safe(info.get("regularMarketPrice"))
    prev_close = _safe(info.get("regularMarketPreviousClose"))

    change = None
    change_pct = None
    if price is not None and prev_close:
        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2)

    return {
        "symbol": symbol.upper(),
        "name": _safe(info.get("shortName"), symbol.upper()),
        "price": price,
        "change": change,
        "changePercent": change_pct,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    return {"message": "Stock Trading Game API is running"}


@app.get("/api/stocks")
async def get_stocks(
    symbols: str = Query(
        ...,
        description="Comma-separated stock symbols, e.g. AAPL,MSFT,GOOGL",
    ),
):
    """Fetch current price data for one or more stock symbols."""
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]

    if not symbol_list:
        raise HTTPException(status_code=400, detail="No symbols provided")

    logger.info("Fetching stocks: %s", symbol_list)
    results: list[dict] = []

    for sym in symbol_list:
        try:
            ticker = yf.Ticker(sym)
            summary = _build_summary(ticker, sym)
            results.append(summary)
        except Exception as exc:
            logger.warning("Failed to fetch %s: %s", sym, exc)
            results.append(
                {
                    "symbol": sym,
                    "name": sym,
                    "price": None,
                    "change": None,
                    "changePercent": None,
                    "error": str(exc),
                }
            )

    return {"stocks": results}


@app.get("/api/stock/{symbol}")
async def get_stock_detail(symbol: str):
    """Fetch detailed info for a single stock symbol."""
    symbol = symbol.strip().upper()
    logger.info("Fetching detail for: %s", symbol)

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
    except Exception as exc:
        logger.error("yfinance error for %s: %s", symbol, exc)
        raise HTTPException(status_code=502, detail=f"Failed to fetch data for {symbol}")

    price = _safe(info.get("currentPrice")) or _safe(info.get("regularMarketPrice"))
    if price is None:
        raise HTTPException(status_code=404, detail=f"No price data found for {symbol}")

    return {
        "symbol": symbol,
        "name": _safe(info.get("shortName"), symbol),
        "price": price,
        "marketCap": _safe(info.get("marketCap")),
        "sector": _safe(info.get("sector"), "N/A"),
        "industry": _safe(info.get("industry"), "N/A"),
    }


# ---------------------------------------------------------------------------
# Run with: uvicorn main:app --reload
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
