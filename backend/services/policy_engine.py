"""
policy_engine.py — Kyma Deterministic Risk Validator.

This is the final guard before any trade is executed. It receives the AI's
decision and parameters, validates them against the user's configured risk
limits, and only executes if everything passes.

It NEVER overrides the LLM's price levels — it only BLOCKS trades that
violate the risk boundaries. This is what makes Kyma a "glass-box" system.
"""

import json
import uuid
import os
from datetime import datetime


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


class PolicyEngine:
    def __init__(self):
        self.max_drawdown_pct   = float(os.getenv("MAX_DRAWDOWN_PCT", "10.0"))
        self.max_lot_size_usdt  = float(os.getenv("MAX_LOT_SIZE_USDT", "500.0"))
        self.risk_per_trade     = float(os.getenv("RISK_PER_TRADE_PCT", "1.0"))
        self.current_drawdown   = 0.0
        self.profit_target      = 0.0        # 0 = disabled
        self.total_realized_pnl = 0.0        # running total across all closed trades

    def configure(self, allocated_capital: float, risk_pct: float, max_dd_pct: float, profit_target: float = 0.0):
        """Called when the agent is deployed with the user's sidebar config."""
        self.allocated_capital  = allocated_capital
        self.risk_per_trade     = risk_pct
        self.max_drawdown_pct   = max_dd_pct
        self.profit_target      = profit_target
        self.max_lot_size_usdt  = allocated_capital * (risk_pct / 100) * 20

    async def evaluate_and_execute(
        self,
        symbol: str,
        direction: str,
        entry: float,
        sl: float,
        tp: float,
        confidence: int = 5,
    ):
        from api.websockets import manager

        async def log(module, msg, log_type="INFO"):
            await manager.broadcast(json.dumps({
                "event": "agent_log",
                "data": {"timestamp": _ts(), "module": module, "message": msg, "type": log_type}
            }))

        # ── Check 0: Profit target reached → auto-stop ───────────────────────
        if self.profit_target > 0 and self.total_realized_pnl >= self.profit_target:
            await log("RISK",
                f"🎯 PROFIT TARGET HIT: ${self.total_realized_pnl:.2f} ≥ ${self.profit_target:.2f} — auto-terminating agent",
                "SUCCESS"
            )
            from api.websockets import manager as ws_manager
            await ws_manager.broadcast(json.dumps({"event": "profit_target_hit", "data": {
                "realized": self.total_realized_pnl,
                "target": self.profit_target,
            }}))
            return

        # ── Check 1: Drawdown limit ───────────────────────────────────────────
        if self.current_drawdown >= self.max_drawdown_pct:
            await log("RISK",
                f"BLOCKED: Max drawdown {self.max_drawdown_pct}% reached — no new positions",
                "CRITICAL"
            )
            return

        # ── Check 2: Validate SL/TP are on correct side of entry ─────────────
        if direction == "BULLISH":
            if sl >= entry:
                await log("RISK", f"BLOCKED: Stop loss ${sl} must be below entry ${entry}", "CRITICAL")
                return
            if tp <= entry:
                await log("RISK", f"BLOCKED: Take profit ${tp} must be above entry ${entry}", "CRITICAL")
                return
        else:
            if sl <= entry:
                await log("RISK", f"BLOCKED: Stop loss ${sl} must be above entry ${entry}", "CRITICAL")
                return
            if tp >= entry:
                await log("RISK", f"BLOCKED: Take profit ${tp} must be below entry ${entry}", "CRITICAL")
                return

        # ── Check 3: Risk:Reward must be ≥ 1.5 ───────────────────────────────
        sl_dist = abs(entry - sl)
        tp_dist = abs(tp - entry)
        rr = tp_dist / sl_dist if sl_dist > 0 else 0
        if rr < 1.5:
            await log("RISK",
                f"BLOCKED: R:R {rr:.2f} is below minimum 1.5 — setup not worth taking",
                "WARNING"
            )
            return

        # ── Check 4: Confidence threshold ────────────────────────────────────
        if confidence < 5:
            await log("RISK",
                f"BLOCKED: AI confidence {confidence}/10 below threshold (5) — standing aside",
                "WARNING"
            )
            return

        # ── Check 5: Lot size ─────────────────────────────────────────────────
        # Scale lot size by confidence: higher confidence = larger size
        base_size   = getattr(self, "max_lot_size_usdt", 200.0)
        conf_mult   = 0.5 + (confidence / 10) * 0.5   # 0.5x at conf=0, 1.0x at conf=10
        lot_size    = round(base_size * conf_mult, 2)
        leverage    = 5 + int(confidence / 2)          # 5x–10x based on confidence

        await log("RISK",
            f"Policy passed: {direction} {symbol} | R:R {rr:.2f} | Size ${lot_size} | {leverage}x lev",
            "SUCCESS"
        )

        # ── Execute trade ─────────────────────────────────────────────────────
        trade_id = f"trd_{uuid.uuid4().hex[:6]}"
        side = "LONG" if direction == "BULLISH" else "SHORT"

        trade_payload = json.dumps({
            "event": "trade_execution",
            "data": {
                "tradeId":    trade_id,
                "symbol":     symbol.replace("/", ""),
                "side":       side,
                "sizeUsdt":   lot_size,
                "leverage":   leverage,
                "entryPrice": round(entry, 6),
                "stopLoss":   round(sl, 6),
                "takeProfit": round(tp, 6),
            }
        })
        await manager.broadcast(trade_payload)

        await log("EXEC",
            f"✓ Trade {trade_id} opened: {side} {symbol} @ ${entry:.4f} | "
            f"SL ${sl:.4f} | TP ${tp:.4f} | {leverage}x",
            "SUCCESS"
        )

    # Keep old interface for backwards compatibility
    async def evaluate_trade(self, symbol: str, direction: str, price: float):
        sl = price * 0.985 if direction == "BULLISH" else price * 1.015
        tp = price * 1.03  if direction == "BULLISH" else price * 0.97
        await self.evaluate_and_execute(symbol, direction, price, sl, tp, confidence=5)
