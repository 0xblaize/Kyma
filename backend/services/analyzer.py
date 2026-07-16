"""
analyzer.py — Kyma Multi-Timeframe Analysis Orchestrator.

Flow per analysis cycle:
  1. Fetch two timeframes of OHLCV from CCXT (short: 15m, confirmation: 4h)
  2. Run full SMC engine on both timeframes
  3. Check confluence — both must agree on direction
  4. If confluent, send to LLM analyst for deep reasoning
  5. Stream every step as agent_log events to the frontend terminal
  6. If LLM approves → send to Policy Engine for risk validation
  7. If approved → emit trade_execution event

Analysis runs only when lifecycle is 'active' (agent is deployed).
"""

import asyncio
import json
import time
import ccxt
from datetime import datetime
from typing import Optional

from services.smc_engine import analyze as smc_analyze
from services.llm_analyst import run_llm_analysis
from services.policy_engine import PolicyEngine


# How often to re-run a full analysis per symbol (seconds)
ANALYSIS_INTERVAL = 60


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


async def _log(module: str, message: str, log_type: str = "INFO"):
    """Broadcast an agent_log event to the frontend Reasoning Terminal."""
    from api.websockets import manager
    payload = json.dumps({
        "event": "agent_log",
        "data": {
            "timestamp": _ts(),
            "module": module,
            "message": message,
            "type": log_type,
        }
    })
    await manager.broadcast(payload)


async def _fetch_candles(symbol_raw: str, timeframe: str, limit: int = 100):
    """
    Fetch OHLCV candles from Binance. symbol_raw = 'BTCUSDT' → 'BTC/USDT'.
    Returns list of { time, open, high, low, close, volume } dicts.
    """
    if "USDT" in symbol_raw and "/" not in symbol_raw:
        base = symbol_raw.replace("USDT", "")
        symbol = f"{base}/USDT"
    else:
        symbol = symbol_raw

    try:
        exchange = ccxt.binanceus({"enableRateLimit": True})
        ohlcv = await asyncio.to_thread(
            exchange.fetch_ohlcv, symbol, timeframe, limit=limit
        )
        return [
            {
                "time":   int(row[0] / 1000),
                "open":   row[1],
                "high":   row[2],
                "low":    row[3],
                "close":  row[4],
                "volume": row[5],
            }
            for row in ohlcv
        ]
    except Exception as e:
        print(f"[Analyzer] OHLCV fetch failed for {symbol} {timeframe}: {e}")
        return []


class MultiTimeframeAnalyzer:
    def __init__(self):
        self.policy_engine = PolicyEngine()
        self.last_analysis: dict[str, float] = {}   # symbol → last analysis timestamp
        self.active_symbols: set[str] = set()
        self.is_running = False

    def set_active_symbols(self, symbols: list[str]):
        self.active_symbols = set(symbols)

    async def process_tick(self, symbol: str, price: float):
        """Called on every live market tick from market_router."""
        if not self.is_running:
            return
        now = time.time()
        last = self.last_analysis.get(symbol, 0)
        if now - last >= ANALYSIS_INTERVAL:
            self.last_analysis[symbol] = now
            asyncio.create_task(self.run_full_analysis(symbol, price))

    async def run_full_analysis(self, symbol: str, price: float):
        """
        Full analysis pipeline: SMC → Confluence → LLM → Policy → Trade.
        """
        from api.websockets import manager

        await _log("PERC", f"Starting analysis on {symbol} @ ${price:.4f}")

        # ── Step 1: Fetch two timeframes ─────────────────────────────────────
        await _log("PERC", f"Fetching 15m + 4h candles for {symbol}…")

        candles_15m, candles_4h = await asyncio.gather(
            _fetch_candles(symbol, "15m", limit=100),
            _fetch_candles(symbol, "4h",  limit=60),
        )

        if len(candles_15m) < 20 or len(candles_4h) < 20:
            await _log("PERC", f"Insufficient data for {symbol} — skipping", "WARNING")
            return

        # ── Step 2: SMC analysis on both timeframes ───────────────────────────
        analysis_15m = smc_analyze(candles_15m)
        analysis_4h  = smc_analyze(candles_4h)
        analysis_15m["symbol"] = symbol
        analysis_4h["symbol"]  = symbol

        await _log("SMC",
            f"15m → {analysis_15m['structure']} | BOS: {analysis_15m['bos']['type'] if analysis_15m['bos'] else 'None'} | "
            f"Zone: {analysis_15m['zone']} | RSI: {analysis_15m['rsi']}"
        )
        await _log("SMC",
            f"4h  → {analysis_4h['structure']} | BOS: {analysis_4h['bos']['type'] if analysis_4h['bos'] else 'None'} | "
            f"Zone: {analysis_4h['zone']} | EMA: {analysis_4h['ema_bias']}"
        )

        # Log FVGs and Order Blocks found
        for fvg in analysis_15m["fair_value_gaps"]:
            await _log("SMC", f"FVG detected: {fvg['type']} gap {fvg['bottom']}–{fvg['top']}")
        for ob in analysis_15m["order_blocks"]:
            await _log("SMC", f"Order Block: {ob['type']} zone {ob['bottom']}–{ob['top']}")
        for sweep in analysis_15m["liquidity_sweeps"]:
            await _log("SMC", f"Liquidity Sweep: {sweep['type']} @ {sweep['level']}", "WARNING")
        if analysis_15m["choch"]:
            await _log("SMC", f"CHoCH: {analysis_15m['choch']['type']} @ {analysis_15m['choch']['level']}", "WARNING")

        # ── Step 3: Multi-Timeframe Confluence check ──────────────────────────
        verdict_15m = analysis_15m["verdict"]
        verdict_4h  = analysis_4h["verdict"]

        long_15m  = "LONG"  in verdict_15m
        short_15m = "SHORT" in verdict_15m
        long_4h   = "LONG"  in verdict_4h
        short_4h  = "SHORT" in verdict_4h

        bullish_confluence = long_15m  and long_4h
        bearish_confluence = short_15m and short_4h

        if not bullish_confluence and not bearish_confluence:
            await _log("RISK",
                f"No confluence on {symbol}: 15m={verdict_15m}, 4h={verdict_4h} — standing aside",
                "WARNING"
            )
            return

        direction = "BULLISH" if bullish_confluence else "BEARISH"
        await _log("RISK",
            f"✓ Confluence confirmed: {direction} on both 15m and 4h for {symbol}",
            "SUCCESS"
        )

        # ── Step 4: LLM deep analysis ─────────────────────────────────────────
        await _log("SMC", f"Sending to AI analyst for deep reasoning on {symbol}…")

        # Pass the 15m (tactical) analysis to the LLM with 4h context injected
        combined = {**analysis_15m}
        combined["macro_structure"] = analysis_4h["structure"]
        combined["macro_ema_bias"]  = analysis_4h["ema_bias"]
        combined["macro_zone"]      = analysis_4h["zone"]

        llm_result = await run_llm_analysis(combined)

        # Stream each reasoning step to the terminal
        for step in llm_result.get("reasoning_steps", []):
            await _log("SMC", step)
            await asyncio.sleep(0.3)   # stagger for terminal readability

        decision = llm_result.get("decision", "STAND_ASIDE")
        confidence = llm_result.get("confidence", 0)
        llm_label = "GPT-4o" if llm_result.get("llm_used") else "Deterministic"

        await _log("EXEC",
            f"[{llm_label}] Decision: {decision} | Confidence: {confidence}/10 | "
            f"R:R {llm_result.get('risk_reward', '?')}:1",
            "SUCCESS" if decision != "STAND_ASIDE" else "WARNING"
        )

        if decision == "STAND_ASIDE":
            await _log("RISK", f"AI elected to stand aside on {symbol} — no high-conviction entry", "WARNING")
            return

        # ── Step 5: Policy Engine risk validation ─────────────────────────────
        entry = llm_result.get("entry_price", price)
        sl    = llm_result.get("stop_loss",   price * 0.985 if direction == "BULLISH" else price * 1.015)
        tp    = llm_result.get("take_profit", price * 1.03  if direction == "BULLISH" else price * 0.97)

        await self.policy_engine.evaluate_and_execute(
            symbol=symbol,
            direction=direction,
            entry=entry,
            sl=sl,
            tp=tp,
            confidence=confidence,
        )
