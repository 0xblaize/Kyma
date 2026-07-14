import json
import random
import uuid
from datetime import datetime

class PolicyEngine:
    def __init__(self):
        # These would normally be loaded from a DB or session config
        self.max_drawdown_percent = 10.0
        self.max_lot_size_usdt = 1000.0
        self.current_drawdown = 0.0
        
    async def evaluate_trade(self, symbol: str, direction: str, price: float):
        from api.websockets import manager
        
        # Simulate an LLM recommending a trade size
        recommended_size = random.uniform(100, 1500)
        
        log_payload = {
            "event": "agent_log",
            "data": {
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "module": "RISK",
                "message": f"Evaluating {direction} on {symbol} at ${price:.2f}. Recommended size: ${recommended_size:.2f}",
                "type": "INFO"
            }
        }
        await manager.broadcast(json.dumps(log_payload))
        
        # Deterministic Policy Checks
        if self.current_drawdown >= self.max_drawdown_percent:
            reject_msg = f"Trade rejected: Max drawdown ({self.max_drawdown_percent}%) reached."
            await self._log_rejection(reject_msg)
            return
            
        if recommended_size > self.max_lot_size_usdt:
            reject_msg = f"Trade rejected: Recommended size (${recommended_size:.2f}) exceeds max lot size cap (${self.max_lot_size_usdt:.2f})."
            await self._log_rejection(reject_msg)
            return
            
        # Trade passed policy engine
        accept_msg = f"Trade approved by Policy Engine. Executing {direction} on {symbol}."
        accept_payload = {
            "event": "agent_log",
            "data": {
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "module": "EXECUTION",
                "message": accept_msg,
                "type": "SUCCESS"
            }
        }
        await manager.broadcast(json.dumps(accept_payload))
        
        # Emit Trade Execution
        trade_id = f"trd_{uuid.uuid4().hex[:6]}"
        sl_offset = price * 0.01
        tp_offset = price * 0.02
        sl = price - sl_offset if direction == "BULLISH" else price + sl_offset
        tp = price + tp_offset if direction == "BULLISH" else price - tp_offset
        
        trade_payload = {
            "event": "trade_execution",
            "data": {
                "tradeId": trade_id,
                "symbol": symbol.replace('/', ''),
                "side": "LONG" if direction == "BULLISH" else "SHORT",
                "sizeUsdt": recommended_size,
                "leverage": 10,
                "entryPrice": price,
                "stopLoss": sl,
                "takeProfit": tp
            }
        }
        await manager.broadcast(json.dumps(trade_payload))

    async def _log_rejection(self, message: str):
        from api.websockets import manager
        log_payload = {
            "event": "agent_log",
            "data": {
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "module": "RISK",
                "message": message,
                "type": "WARNING"
            }
        }
        await manager.broadcast(json.dumps(log_payload))
