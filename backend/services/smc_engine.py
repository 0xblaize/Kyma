"""
smc_engine.py — Pure deterministic Smart Money Concepts calculator.

Takes raw OHLCV candles and computes every market structure signal:
  • Market Structure (HH / HL / LH / LL)
  • Break of Structure (BOS)
  • Change of Character (CHoCH)
  • Fair Value Gaps (FVG) — bullish and bearish
  • Order Blocks (OB) — last bullish/bearish candle before BOS
  • Liquidity Sweeps — equal highs/lows grabbed and rejected
  • Premium / Discount Zones — relative to current swing range
  • Trend EMA bias (20/50 EMA crossover)
  • Momentum (RSI-14)
  • Volume confirmation

All outputs are plain dicts — no external dependencies beyond numpy.
"""

import numpy as np
from typing import List, Dict, Any


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ema(values: List[float], period: int) -> List[float]:
    result = []
    k = 2 / (period + 1)
    ema = values[0]
    for v in values:
        ema = v * k + ema * (1 - k)
        result.append(ema)
    return result


def _rsi(closes: List[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = np.diff(closes[-period - 1:])
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = np.mean(gains) if gains.any() else 1e-9
    avg_loss = np.mean(losses) if losses.any() else 1e-9
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def _swing_highs_lows(highs: List[float], lows: List[float], lookback: int = 3):
    """Returns indices of swing highs and lows using a simple pivot approach."""
    sh, sl = [], []
    for i in range(lookback, len(highs) - lookback):
        if all(highs[i] > highs[i - j] for j in range(1, lookback + 1)) and \
           all(highs[i] > highs[i + j] for j in range(1, lookback + 1)):
            sh.append(i)
        if all(lows[i] < lows[i - j] for j in range(1, lookback + 1)) and \
           all(lows[i] < lows[i + j] for j in range(1, lookback + 1)):
            sl.append(i)
    return sh, sl


# ─── Main Analysis Function ────────────────────────────────────────────────────

def analyze(candles: List[Dict]) -> Dict[str, Any]:
    """
    Run full SMC analysis on a list of OHLCV candle dicts.
    Each candle: { time, open, high, low, close, volume }
    Returns a structured analysis report.
    """
    if len(candles) < 20:
        return {"error": "Not enough candles for analysis (need ≥ 20)"}

    opens  = [c["open"]   for c in candles]
    highs  = [c["high"]   for c in candles]
    lows   = [c["low"]    for c in candles]
    closes = [c["close"]  for c in candles]
    vols   = [c.get("volume", 0) for c in candles]

    # ── 1. EMA Bias ───────────────────────────────────────────────────────────
    ema20 = _ema(closes, 20)
    ema50 = _ema(closes, 50) if len(closes) >= 50 else ema20
    ema_bias = "BULLISH" if ema20[-1] > ema50[-1] else "BEARISH"
    ema_gap_pct = round(abs(ema20[-1] - ema50[-1]) / ema50[-1] * 100, 3)

    # ── 2. RSI Momentum ───────────────────────────────────────────────────────
    rsi = _rsi(closes)
    if rsi >= 70:
        rsi_signal = "OVERBOUGHT"
    elif rsi <= 30:
        rsi_signal = "OVERSOLD"
    elif rsi >= 55:
        rsi_signal = "BULLISH_MOMENTUM"
    elif rsi <= 45:
        rsi_signal = "BEARISH_MOMENTUM"
    else:
        rsi_signal = "NEUTRAL"

    # ── 3. Swing Structure — HH/HL/LH/LL ─────────────────────────────────────
    sh_idx, sl_idx = _swing_highs_lows(highs, lows, lookback=3)

    recent_sh = [highs[i] for i in sh_idx[-4:]] if sh_idx else []
    recent_sl = [lows[i]  for i in sl_idx[-4:]] if sl_idx else []

    structure = "RANGING"
    if len(recent_sh) >= 2 and len(recent_sl) >= 2:
        if recent_sh[-1] > recent_sh[-2] and recent_sl[-1] > recent_sl[-2]:
            structure = "UPTREND"       # HH + HL
        elif recent_sh[-1] < recent_sh[-2] and recent_sl[-1] < recent_sl[-2]:
            structure = "DOWNTREND"     # LH + LL

    # ── 4. Break of Structure (BOS) ───────────────────────────────────────────
    bos = None
    last_price = closes[-1]
    if sh_idx and last_price > highs[sh_idx[-1]]:
        bos = {"type": "BULLISH_BOS", "level": round(highs[sh_idx[-1]], 6)}
    elif sl_idx and last_price < lows[sl_idx[-1]]:
        bos = {"type": "BEARISH_BOS", "level": round(lows[sl_idx[-1]], 6)}

    # ── 5. Change of Character (CHoCH) ────────────────────────────────────────
    choch = None
    if structure == "UPTREND" and sl_idx and last_price < lows[sl_idx[-1]]:
        choch = {"type": "BEARISH_CHOCH", "level": round(lows[sl_idx[-1]], 6)}
    elif structure == "DOWNTREND" and sh_idx and last_price > highs[sh_idx[-1]]:
        choch = {"type": "BULLISH_CHOCH", "level": round(highs[sh_idx[-1]], 6)}

    # ── 6. Fair Value Gaps (FVG) ──────────────────────────────────────────────
    fvgs = []
    for i in range(2, len(candles)):
        prev_high = highs[i - 2]
        prev_low  = lows[i - 2]
        curr_high = highs[i]
        curr_low  = lows[i]
        # Bullish FVG: gap between candle[i-2] high and candle[i] low
        if curr_low > prev_high:
            fvgs.append({
                "type": "BULLISH_FVG",
                "top":    round(curr_low, 6),
                "bottom": round(prev_high, 6),
                "mid":    round((curr_low + prev_high) / 2, 6),
                "index":  i,
            })
        # Bearish FVG: gap between candle[i-2] low and candle[i] high
        elif curr_high < prev_low:
            fvgs.append({
                "type": "BEARISH_FVG",
                "top":    round(prev_low, 6),
                "bottom": round(curr_high, 6),
                "mid":    round((prev_low + curr_high) / 2, 6),
                "index":  i,
            })
    # Keep only the 3 most recent FVGs
    recent_fvgs = fvgs[-3:] if fvgs else []

    # ── 7. Order Blocks (OB) ──────────────────────────────────────────────────
    # Last bearish candle (red) before a bullish BOS = bullish OB
    # Last bullish candle (green) before a bearish BOS = bearish OB
    order_blocks = []
    for i in range(1, len(candles) - 1):
        # Bullish OB: bearish candle followed by strong up-move (next closes above OB high)
        if closes[i] < opens[i]:   # bearish candle
            if closes[i + 1] > highs[i]:
                order_blocks.append({
                    "type": "BULLISH_OB",
                    "top":    round(highs[i], 6),
                    "bottom": round(lows[i], 6),
                    "mid":    round((highs[i] + lows[i]) / 2, 6),
                    "index":  i,
                })
        # Bearish OB: bullish candle followed by strong down-move
        elif closes[i] > opens[i]:  # bullish candle
            if closes[i + 1] < lows[i]:
                order_blocks.append({
                    "type": "BEARISH_OB",
                    "top":    round(highs[i], 6),
                    "bottom": round(lows[i], 6),
                    "mid":    round((highs[i] + lows[i]) / 2, 6),
                    "index":  i,
                })
    recent_obs = order_blocks[-3:] if order_blocks else []

    # ── 8. Liquidity Sweeps ───────────────────────────────────────────────────
    # Equal highs/lows within 0.05% are "liquidity pools". A sweep occurs when
    # price wicks through them and closes back the other side.
    sweeps = []
    tolerance = 0.0005
    for i in range(5, len(candles)):
        # Check if any previous high within last 20 candles is within tolerance
        window_highs = highs[max(0, i - 20):i - 1]
        window_lows  = lows[max(0, i - 20):i - 1]
        ref_high = max(window_highs) if window_highs else None
        ref_low  = min(window_lows)  if window_lows  else None
        if ref_high and highs[i] > ref_high * (1 + tolerance) and closes[i] < ref_high:
            sweeps.append({"type": "BEARISH_SWEEP", "level": round(ref_high, 6), "index": i})
        if ref_low and lows[i] < ref_low * (1 - tolerance) and closes[i] > ref_low:
            sweeps.append({"type": "BULLISH_SWEEP", "level": round(ref_low, 6), "index": i})
    recent_sweeps = sweeps[-3:] if sweeps else []

    # ── 9. Premium / Discount Zone ────────────────────────────────────────────
    swing_high = max(highs[-20:]) if len(highs) >= 20 else max(highs)
    swing_low  = min(lows[-20:])  if len(lows)  >= 20 else min(lows)
    range_size = swing_high - swing_low
    equilibrium = swing_low + range_size * 0.5
    premium_start = swing_low + range_size * 0.618
    discount_end  = swing_low + range_size * 0.382

    if last_price > premium_start:
        zone = "PREMIUM"        # potential short zone
    elif last_price < discount_end:
        zone = "DISCOUNT"       # potential long zone
    else:
        zone = "EQUILIBRIUM"

    # ── 10. Volume Confirmation ───────────────────────────────────────────────
    avg_vol = np.mean(vols[-20:]) if vols else 1
    last_vol = vols[-1] if vols else 0
    vol_confirmation = last_vol > avg_vol * 1.2

    # ── 11. Overall Signal Score ──────────────────────────────────────────────
    # Score 0–10 for long / short. Tallies all signals.
    long_score  = 0
    short_score = 0

    if ema_bias == "BULLISH":     long_score  += 2
    else:                         short_score += 2
    if structure == "UPTREND":    long_score  += 2
    elif structure == "DOWNTREND":short_score += 2
    if rsi_signal == "BULLISH_MOMENTUM": long_score  += 1
    if rsi_signal == "BEARISH_MOMENTUM": short_score += 1
    if rsi_signal == "OVERSOLD":         long_score  += 2
    if rsi_signal == "OVERBOUGHT":       short_score += 2
    if zone == "DISCOUNT":        long_score  += 1
    if zone == "PREMIUM":         short_score += 1
    if bos and "BULLISH" in bos["type"]: long_score  += 1
    if bos and "BEARISH" in bos["type"]: short_score += 1
    if choch and "BULLISH" in choch["type"]: long_score  += 1
    if choch and "BEARISH" in choch["type"]: short_score += 1
    if vol_confirmation:
        # Volume confirms whichever direction price was moving
        if closes[-1] > closes[-2]: long_score  += 1
        else:                       short_score += 1

    # Determine verdict
    if long_score >= 6 and long_score > short_score + 1:
        verdict = "STRONG_LONG"
    elif short_score >= 6 and short_score > long_score + 1:
        verdict = "STRONG_SHORT"
    elif long_score > short_score:
        verdict = "WEAK_LONG"
    elif short_score > long_score:
        verdict = "WEAK_SHORT"
    else:
        verdict = "NO_TRADE"    # conflicting signals — stand aside

    return {
        "symbol":            None,   # filled by caller
        "current_price":     round(last_price, 6),
        "ema_bias":          ema_bias,
        "ema_gap_pct":       ema_gap_pct,
        "rsi":               rsi,
        "rsi_signal":        rsi_signal,
        "structure":         structure,
        "zone":              zone,
        "equilibrium":       round(equilibrium, 6),
        "swing_high":        round(swing_high, 6),
        "swing_low":         round(swing_low, 6),
        "bos":               bos,
        "choch":             choch,
        "fair_value_gaps":   recent_fvgs,
        "order_blocks":      recent_obs,
        "liquidity_sweeps":  recent_sweeps,
        "volume_confirmed":  vol_confirmation,
        "long_score":        long_score,
        "short_score":       short_score,
        "verdict":           verdict,
    }
