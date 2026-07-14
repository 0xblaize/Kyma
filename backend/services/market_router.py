import asyncio
import ccxt.pro as ccxt
import time
import json
from api.websockets import manager
from services.analyzer import MultiTimeframeAnalyzer

# Top 10 crypto assets to monitor
MARKETS = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", 
    "XRP/USDT", "ADA/USDT", "AVAX/USDT", "DOGE/USDT", 
    "LINK/USDT", "DOT/USDT"
]

analyzer = MultiTimeframeAnalyzer()

async def start_market_router():
    exchange = ccxt.binance({
        'enableRateLimit': True,
        'options': {'defaultType': 'future'}
    })
    
    while True:
        try:
            # We'll stream tickers for all markets concurrently
            # However, for simplicity and stability, we fetch them via watch_tickers if supported, or loop
            tickers = await exchange.watch_tickers(MARKETS)
            
            for symbol, ticker in tickers.items():
                if symbol in MARKETS:
                    # Format for frontend
                    payload = {
                        "event": "market_tick",
                        "data": {
                            "symbol": symbol.replace('/', ''),
                            "price": ticker['last'],
                            "timestamp": int(time.time() * 1000)
                        }
                    }
                    # Send to any connected websocket clients tracking this symbol or globally
                    await manager.broadcast(json.dumps(payload))
                    
                    # Pass tick to analyzer
                    await analyzer.process_tick(symbol, ticker['last'])
                    
        except Exception as e:
            print(f"Error in market router: {e}")
            await asyncio.sleep(5)
