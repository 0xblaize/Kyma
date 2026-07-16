from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json
import ccxt.pro as ccxtpro
import ccxt
import asyncio

router = APIRouter()

# Timeframe map — converts frontend label to CCXT-compatible string
TF_MAP = {
    '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m',
    '30m': '30m', '1h': '1h', '2h': '2h', '4h': '4h',
    '6h': '6h', '12h': '12h', '1d': '1d',
}

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

async def fetch_historical_candles(symbol_raw: str, timeframe: str, limit: int = 100):
    """
    Fetch real OHLCV candles from Binance via CCXT (sync client).
    symbol_raw is in BTCUSDT format; CCXT expects BTC/USDT.
    """
    # Convert BTCUSDT -> BTC/USDT
    if 'USDT' in symbol_raw and '/' not in symbol_raw:
        base = symbol_raw.replace('USDT', '')
        symbol = f"{base}/USDT"
    else:
        symbol = symbol_raw

    tf = TF_MAP.get(timeframe, '1h')

    try:
        exchange = ccxt.binanceus({'enableRateLimit': True})
        # fetch_ohlcv returns [[timestamp, open, high, low, close, volume], ...]
        ohlcv = await asyncio.to_thread(
            exchange.fetch_ohlcv, symbol, tf, limit=limit
        )
        candles = [
            {
                'time': int(row[0] / 1000),  # ms -> seconds
                'open': row[1],
                'high': row[2],
                'low': row[3],
                'close': row[4],
                'volume': row[5],
            }
            for row in ohlcv
        ]
        return candles
    except Exception as e:
        print(f"[OHLCV] Failed to fetch {symbol} {tf}: {e}")
        return []


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()

            # Try to parse as JSON action first
            try:
                msg = json.loads(data)
                action = msg.get('action', '')

                if action == 'subscribe_market':
                    symbol = msg.get('symbol', 'BTCUSDT')
                    timeframe = msg.get('timeframe', '1h')
                    print(f"[WS] subscribe_market: {symbol} @ {timeframe}")

                    # Fetch and send historical candles immediately
                    candles = await fetch_historical_candles(symbol, timeframe)
                    if candles:
                        payload = json.dumps({
                            'event': 'historical_candles',
                            'data': {
                                'symbol': symbol,
                                'timeframe': timeframe,
                                'candles': candles,
                            }
                        })
                        await manager.send_personal_message(payload, websocket)
                        print(f"[WS] Sent {len(candles)} candles for {symbol} {timeframe}")

            except (json.JSONDecodeError, AttributeError):
                # Plain text command (e.g. START_ENGINE)
                print(f"[WS] Received: {data}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
