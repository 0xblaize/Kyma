"""
llm_analyst.py — AI-powered market analyst for Kyma Terminal.

Uses the Bitget Qwen LLM (already configured in the project) to reason
through all SMC signals and produce a structured trade decision.

Env vars (already present in .env.local / Railway):
  LLM_BASE_URL  — e.g. https://hackathon.bitgetops.com/v1
  LLM_API_KEY   — your Bitget hackathon key
  LLM_MODEL     — e.g. qwen3.6-plus
"""

import os
import json
import asyncio
from typing import Dict, Any, Optional

try:
    from openai import AsyncOpenAI   # openai SDK works with any OpenAI-compatible endpoint
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# ── Read from existing env vars ────────────────────────────────────────────────
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://hackathon.bitgetops.com/v1")
LLM_API_KEY  = os.getenv("LLM_API_KEY",  "")
LLM_MODEL    = os.getenv("LLM_MODEL",    "qwen3.6-plus")


def _build_system_prompt() -> str:
    return """You are Kyma, an elite institutional-grade trading analyst specializing in 
Smart Money Concepts (SMC) and Price Action analysis. You have deep expertise in:

- Market Structure (HH/HL/LH/LL, trend identification)
- Break of Structure (BOS) and Change of Character (CHoCH)
- Fair Value Gaps (FVG) — bullish and bearish imbalances
- Order Blocks (OB) — institutional footprints
- Liquidity Sweeps — equal highs/lows, stop hunts
- Premium and Discount Zones (Fibonacci 61.8% / 38.2%)
- EMA trend bias (20/50 crossover)
- RSI momentum confirmation
- Volume analysis

Your job is to receive a full technical analysis report, reason through ALL the signals 
systematically, and produce a precise trade decision. You NEVER enter a trade without 
multi-signal confluence. If signals conflict, you STAND ASIDE.

Respond in this exact JSON format:
{
  "decision": "LONG" | "SHORT" | "STAND_ASIDE",
  "confidence": 1-10,
  "reasoning_steps": [
    "Step 1: [your reasoning about structure]",
    "Step 2: [your reasoning about BOS/CHoCH]",
    "Step 3: [your reasoning about FVG/OB]",
    "Step 4: [your reasoning about liquidity]",
    "Step 5: [your reasoning about zone and momentum]",
    "Step 6: [final confluence verdict]"
  ],
  "entry_price": <number or null>,
  "stop_loss": <number or null>,
  "take_profit": <number or null>,
  "risk_reward": <number or null>,
  "invalidation": "<what would invalidate this setup>"
}

Be precise, professional, and concise. Do not add fields outside this schema."""


def _build_user_prompt(analysis: Dict[str, Any]) -> str:
    symbol = analysis.get("symbol", "UNKNOWN")
    price  = analysis.get("current_price", 0)

    return f"""Analyze this live market data for {symbol} and determine the best trade:

CURRENT PRICE: ${price}

TREND & BIAS:
- EMA Bias: {analysis['ema_bias']} (20/50 gap: {analysis['ema_gap_pct']}%)
- Market Structure: {analysis['structure']}
- RSI(14): {analysis['rsi']} → {analysis['rsi_signal']}

PRICE ACTION:
- Break of Structure: {json.dumps(analysis['bos']) if analysis['bos'] else 'None detected'}
- Change of Character: {json.dumps(analysis['choch']) if analysis['choch'] else 'None detected'}

INSTITUTIONAL ZONES:
- Current Zone: {analysis['zone']} (Swing H: {analysis['swing_high']}, Swing L: {analysis['swing_low']}, EQ: {analysis['equilibrium']})
- Order Blocks: {json.dumps(analysis['order_blocks']) if analysis['order_blocks'] else 'None'}
- Fair Value Gaps: {json.dumps(analysis['fair_value_gaps']) if analysis['fair_value_gaps'] else 'None'}
- Liquidity Sweeps: {json.dumps(analysis['liquidity_sweeps']) if analysis['liquidity_sweeps'] else 'None'}

VOLUME: {'Confirmed (above average)' if analysis['volume_confirmed'] else 'Below average — weak conviction'}

DETERMINISTIC SCORE:
- Long Score: {analysis['long_score']}/10
- Short Score: {analysis['short_score']}/10
- Engine Verdict: {analysis['verdict']}

Based on ALL of these signals, provide your full analysis and trade decision."""


async def run_llm_analysis(
    analysis: Dict[str, Any],
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Runs the Qwen LLM analysis via the Bitget hackathon endpoint.
    Falls back to deterministic SMC verdict if LLM is unavailable.
    """
    key = api_key or LLM_API_KEY

    # ── Fallback: deterministic SMC verdict ───────────────────────────────
    if not OPENAI_AVAILABLE or not key:
        verdict  = analysis.get("verdict", "NO_TRADE")
        decision = "LONG" if "LONG" in verdict else ("SHORT" if "SHORT" in verdict else "STAND_ASIDE")
        price    = analysis.get("current_price", 0)
        sl_pct, tp_pct = 0.015, 0.03
        return {
            "decision":    decision,
            "confidence":  analysis.get("long_score") if decision == "LONG" else analysis.get("short_score"),
            "reasoning_steps": [
                f"EMA Bias: {analysis.get('ema_bias')} ({analysis.get('ema_gap_pct')}% spread)",
                f"Market Structure: {analysis.get('structure')}",
                f"RSI {analysis.get('rsi')} → {analysis.get('rsi_signal')}",
                f"Zone: {analysis.get('zone')} — price at ${price}",
                f"BOS: {analysis.get('bos')} | CHoCH: {analysis.get('choch')}",
                f"Deterministic verdict: {verdict} (Long {analysis.get('long_score')}/10, Short {analysis.get('short_score')}/10)",
            ],
            "entry_price": price,
            "stop_loss":   round(price * (1 - sl_pct) if decision == "LONG" else price * (1 + sl_pct), 6),
            "take_profit": round(price * (1 + tp_pct) if decision == "LONG" else price * (1 - tp_pct), 6),
            "risk_reward": round(tp_pct / sl_pct, 1),
            "invalidation": f"Close {'below' if decision == 'LONG' else 'above'} key swing level",
            "llm_used": False,
        }

    # ── Qwen LLM analysis ─────────────────────────────────────────────────
    try:
        # The openai SDK is fully compatible with any OpenAI-spec endpoint
        client = AsyncOpenAI(
            api_key=key,
            base_url=LLM_BASE_URL,
        )
        response = await client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": _build_system_prompt()},
                {"role": "user",   "content": _build_user_prompt(analysis)},
            ],
            temperature=0.2,
            max_tokens=800,
        )
        raw = response.choices[0].message.content or ""

        # Qwen sometimes wraps JSON in markdown fences — strip them
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw.strip())
        result["llm_used"] = True
        return result

    except Exception as e:
        print(f"[LLM] Qwen call failed: {e} — falling back to deterministic")
        verdict  = analysis.get("verdict", "NO_TRADE")
        decision = "LONG" if "LONG" in verdict else ("SHORT" if "SHORT" in verdict else "STAND_ASIDE")
        price    = analysis.get("current_price", 0)
        return {
            "decision":    decision,
            "confidence":  5,
            "reasoning_steps": [f"LLM error: {str(e)}", f"Deterministic verdict: {verdict}"],
            "entry_price": price,
            "stop_loss":   round(price * 0.985 if decision == "LONG" else price * 1.015, 6),
            "take_profit": round(price * 1.030 if decision == "LONG" else price * 0.970, 6),
            "risk_reward": 2.0,
            "invalidation": "Key level violated",
            "llm_used": False,
        }
