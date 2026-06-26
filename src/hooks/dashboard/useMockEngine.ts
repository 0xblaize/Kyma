'use client'

import { useEffect, useRef } from 'react'
import {
  useDashboardState,
  type LogModule,
  type LogType,
  type Position,
  type RiskTier,
} from './useDashboardState'

// ─────────────────────────────────────────────────────────────────────────
// Real perp universe — Binance/Bybit USDT-margined perpetual symbols. The
// agent scans every one of these each cycle, scores the setups, and only
// enters the strongest. Per-symbol vol multiplier is calibrated to typical
// 1m ATR so the random walk feels right for each asset (BTC ~tight, DOGE
// ~loose). Reference price seeds the walk on boot/reset only.
// ─────────────────────────────────────────────────────────────────────────
interface MarketDef {
  symbol: string
  seed: number          // reference spot price ($) — drift target
  vol: number           // per-tick noise stddev as fraction of seed
}

const MARKETS: MarketDef[] = [
  { symbol: 'BTCUSDT',  seed: 64_500, vol: 0.0009 },
  { symbol: 'ETHUSDT',  seed: 3_180,  vol: 0.0011 },
  { symbol: 'SOLUSDT',  seed: 148,    vol: 0.0016 },
  { symbol: 'BNBUSDT',  seed: 575,    vol: 0.0010 },
  { symbol: 'XRPUSDT',  seed: 0.52,   vol: 0.0014 },
  { symbol: 'DOGEUSDT', seed: 0.121,  vol: 0.0021 },
  { symbol: 'AVAXUSDT', seed: 26.4,   vol: 0.0018 },
  { symbol: 'LINKUSDT', seed: 13.8,   vol: 0.0017 },
]

// ─────────────────────────────────────────────────────────────────────────
// useMockEngine — the Vol.2 §4 Hackathon Failsafe.
//
// Drives all four data feeds from setInterval timers so the dashboard looks
// 100% alive even when the NestJS/Socket.io backend is unavailable. Emits
// data into the global store using the same payload shape the real backend
// would send — so when the backend lands, this hook is the only file that
// gets ripped out.
//
// Lifecycle gating:
//   - lifecycle === 'active'  → all timers run
//   - lifecycle === 'paused'  → no new ticks/logs/trades, existing state held
//   - lifecycle !== 'active'  → all timers torn down
//
// Resets: every change to resetNonce re-seeds the price walk; the timers
// themselves restart whenever lifecycle flips back to 'active'.
// ─────────────────────────────────────────────────────────────────────────

const START_PRICE = 64_500

const PERCEPTION_LINES = [
  'Liquidity sweep detected — sub-1m timeframe',
  'Order flow imbalance flagged · ask-side dominance',
  'Volatility envelope expanded by 1.3σ',
  'Equal lows printed at $64,210 · poaching zone',
  'Wick rejection at premium discount boundary',
  'Funding rate cooling toward neutral',
]

const SMC_LINES = [
  'Bullish Order Block confirmed on BTCUSDT',
  'Break of Structure (BOS) — uptrend continuation',
  'Fair Value Gap identified at',
  'Change of Character (CHoCH) — bearish pivot',
  'Premium array invalidated · seek discount entry',
]

const RISK_LINES = [
  'Position sizing recalculated',
  'Drawdown buffer healthy · 3.2x cushion',
  'Correlation check passed · low BTC/ETH beta',
  'Slippage budget within tolerance',
  'Heat map below 0.7 — clear to size up',
]

const EXEC_LINES = [
  'Limit order placed — patient fill',
  'Market order executed at',
  'Stop-loss armed',
  'Take-profit ladder seeded',
  'Position closed · realised',
]

function hhmmss(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randTradeId() {
  // 6-char base36 like 'trd_9a8b7c'
  return 'trd_' + Math.random().toString(36).slice(2, 8)
}

// Display helpers — qty digits scale with the asset's price (5.42 SOL but
// 0.00342 BTC). fmtPriceSymbol picks digits per symbol so cents don't get
// rounded off on DOGE/XRP.
function fmtQty(qty: number) {
  if (qty >= 1_000) return qty.toFixed(0)
  if (qty >= 1) return qty.toFixed(3)
  if (qty >= 0.001) return qty.toFixed(5)
  return qty.toFixed(8)
}
function fmtPriceFor(price: number) {
  if (price >= 1_000) return price.toFixed(2)
  if (price >= 10) return price.toFixed(3)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(5)
}

// Capital → concurrent-position cap. Larger books support more parallel
// setups; tiny books concentrate into one high-conviction trade.
function maxPositionsFor(capital: number) {
  if (capital < 500) return 1
  if (capital < 2_000) return 2
  if (capital < 5_000) return 3
  if (capital < 10_000) return 4
  return 5
}

interface MarketState {
  seed: number
  vol: number
  price: number
  momentum: number    // EMA of pct-change; sign = directional bias
}

export function useMockEngine() {
  const {
    lifecycle,
    resetNonce,
    allocatedCapital,
    riskPerTrade,
    maxDrawdownPct,
    pushTick,
    pushLog,
    pushOrderBlock,
    openPosition,
    closePosition,
    updatePositions,
    terminate,
  } = useDashboardState()

  // Mutable refs so the interval bodies can read fresh values without
  // restarting every tick — re-binding setInterval would drop sub-second
  // precision. Refs sync from props above each render.
  const priceRef = useRef<number>(START_PRICE)
  const marketsRef = useRef<Record<string, MarketState>>(
    Object.fromEntries(
      MARKETS.map((m) => [m.symbol, { seed: m.seed, vol: m.vol, price: m.seed, momentum: 0 }]),
    ),
  )
  const positionsRef = useRef<Position[]>([])
  const cumulativeRealizedRef = useRef<number>(0)
  const capitalRef = useRef<number>(allocatedCapital)
  const riskRef = useRef<number>(riskPerTrade)
  const ddRef = useRef<number>(maxDrawdownPct)

  capitalRef.current = allocatedCapital
  riskRef.current = riskPerTrade
  ddRef.current = maxDrawdownPct

  // Re-seed price on reset so the chart doesn't drift forever.
  useEffect(() => {
    priceRef.current = START_PRICE
    for (const m of MARKETS) {
      marketsRef.current[m.symbol] = { seed: m.seed, vol: m.vol, price: m.seed, momentum: 0 }
    }
    positionsRef.current = []
    cumulativeRealizedRef.current = 0
  }, [resetNonce])

  useEffect(() => {
    if (lifecycle !== 'active') return

    // ── 1. Market ticks — 1Hz across the whole basket ────────────────────
    // Walk every symbol so the scanner has live data on each. The chart is
    // anchored to BTCUSDT (its single price series), but every position
    // marks against its own symbol's price ref below.
    const tickTimer = setInterval(() => {
      for (const m of MARKETS) {
        const s = marketsRef.current[m.symbol]
        const drift = (s.seed - s.price) * 0.002
        const noise = (Math.random() - 0.5) * s.seed * s.vol * 2
        const next = Math.max(s.seed * 0.4, s.price + drift + noise)
        // EMA of pct-change → momentum signal used by the scanner. Larger
        // |momentum| = stronger directional bias = better setup score.
        const pct = (next - s.price) / Math.max(1e-9, s.price)
        s.momentum = s.momentum * 0.88 + pct * 0.12
        s.price = next
      }
      // Keep BTC as the chart-facing tick so SMCChart stays coherent.
      priceRef.current = marketsRef.current['BTCUSDT'].price
      pushTick(priceRef.current)
    }, 1000)

    // ── 2. Reasoning logs — staggered modules ────────────────────────────
    // We rotate modules so the terminal feels like four threads of thought
    // rather than one. Cadence ~1.6s with jitter.
    let logBeat = 0
    const logTimer = setInterval(() => {
      logBeat++
      const mod: LogModule = (['PERC', 'SMC', 'RISK', 'EXEC'] as const)[logBeat % 4]
      const price = priceRef.current
      const fmt = (n: number) => `$${n.toFixed(2)}`
      let message = ''
      let type: LogType = 'INFO'
      switch (mod) {
        case 'PERC':
          message = pick(PERCEPTION_LINES)
          break
        case 'SMC': {
          const base = pick(SMC_LINES)
          message = base.endsWith('at')
            ? `${base} ${fmt(price + (Math.random() * 100 - 50))}`
            : `${base} at ${fmt(price)}`
          break
        }
        case 'RISK':
          message = pick(RISK_LINES)
          type = Math.random() < 0.15 ? 'WARNING' : 'INFO'
          break
        case 'EXEC': {
          const base = pick(EXEC_LINES)
          message = base.endsWith('at') || base.endsWith('realised')
            ? `${base} ${fmt(price)}`
            : base
          type = 'SUCCESS'
          break
        }
      }
      pushLog({ time: hhmmss(), module: mod, message, type })
    }, 1600)

    // ── 3. Order blocks — every ~15s (Vol.2 §2 event 3) ──────────────────
    const obTimer = setInterval(() => {
      const direction: 'BULLISH' | 'BEARISH' = Math.random() > 0.5 ? 'BULLISH' : 'BEARISH'
      const offset = (Math.random() * 200 + 50) * (direction === 'BULLISH' ? -1 : 1)
      const priceLevel = priceRef.current + offset
      pushOrderBlock({
        priceLevel,
        direction,
        asset: 'BTCUSDT',
        createdAt: Date.now(),
      })
      pushLog({
        time: hhmmss(),
        module: 'SMC',
        message: `${direction === 'BULLISH' ? 'Bullish' : 'Bearish'} Order Block flagged @ $${priceLevel.toFixed(2)}`,
        type: 'INFO',
      })
    }, 15_000)

    // ── 4. Trade execution — basket scanner, every ~12s ──────────────────
    // The agent scores every market by |momentum| × vol-bonus, skips any
    // symbol already held (no double-stacking), and enters the best setup.
    // Concurrent-position cap scales with allocated capital — a $200 book
    // concentrates into one trade; a $20k book runs five in parallel.
    const tradeTimer = setInterval(() => {
      if (capitalRef.current <= 0) return
      const cap = maxPositionsFor(capitalRef.current)
      if (positionsRef.current.length >= cap) return

      const held = new Set(positionsRef.current.map((p) => p.symbol))
      const candidates = MARKETS
        .filter((m) => !held.has(m.symbol))
        .map((m) => {
          const s = marketsRef.current[m.symbol]
          // Score = signal strength × vol-tilt. Higher-vol books pay more
          // when the directional read is right, so we tilt toward them
          // when momentum is comparable.
          const score = Math.abs(s.momentum) * (1 + m.vol * 60)
          return { def: m, state: s, score }
        })
        .sort((a, b) => b.score - a.score)
      if (!candidates.length) return
      const pick_ = candidates[0]
      // Floor on score so we don't open a trade on noise alone.
      if (pick_.score < 0.0004) return

      const side: 'LONG' | 'SHORT' = pick_.state.momentum >= 0 ? 'LONG' : 'SHORT'
      const entryPrice = pick_.state.price

      // Regression-aware sizing: when the setup is on a high-vol book AND
      // the read is strong, the bot expects a deeper retrace before the
      // pump. It commits more notional and widens SL so a normal wick
      // can't take it out — but drops leverage so liquidation stays clear.
      const aggressive = pick_.def.vol >= 0.0015 && pick_.score > 0.0009
      const tier: RiskTier = aggressive ? 'AGGRESSIVE' : 'BASE'

      const baseSize = Math.max(50, capitalRef.current * (riskRef.current / 100) * 20)
      const sizeUsdt = tier === 'AGGRESSIVE' ? baseSize * 2.2 : baseSize
      const leverage = tier === 'AGGRESSIVE'
        ? 3 + Math.floor(Math.random() * 4)     // 3–6x — survives the dip
        : 5 + Math.floor(Math.random() * 11)    // 5–15x — standard
      const slPct = tier === 'AGGRESSIVE' ? 0.025 : 0.01
      const tpPct = tier === 'AGGRESSIVE' ? 0.05 : 0.022
      const slDistance = entryPrice * slPct
      const tpDistance = entryPrice * tpPct
      const qty = (sizeUsdt * leverage) / entryPrice

      const pos: Position = {
        tradeId: randTradeId(),
        symbol: pick_.def.symbol,
        side,
        sizeUsdt,
        qty,
        leverage,
        entryPrice,
        stopLoss: side === 'LONG' ? entryPrice - slDistance : entryPrice + slDistance,
        takeProfit: side === 'LONG' ? entryPrice + tpDistance : entryPrice - tpDistance,
        liqPrice: side === 'LONG'
          ? entryPrice * (1 - 1 / leverage)
          : entryPrice * (1 + 1 / leverage),
        markPrice: entryPrice,
        pnl: 0,
        riskTier: tier,
      }
      positionsRef.current = [...positionsRef.current, pos]
      openPosition(pos)
      pushLog({
        time: hhmmss(),
        module: 'PERC',
        message: `Top setup → ${pos.symbol} · momentum ${(pick_.state.momentum * 100).toFixed(3)}% · ${tier === 'AGGRESSIVE' ? 'regression-buffered' : 'baseline'}`,
        type: 'INFO',
      })
      pushLog({
        time: hhmmss(),
        module: 'EXEC',
        message: `${side} ${pos.symbol} · qty ${fmtQty(qty)} · ${pos.leverage}x · $${sizeUsdt.toFixed(2)} notional @ ${fmtPriceFor(entryPrice)}${tier === 'AGGRESSIVE' ? ' · SL widened for regression' : ''}`,
        type: 'SUCCESS',
      })
    }, 12_000)

    // ── 5. Portfolio updates — 500ms (Spec §6.2 PNL flicker) ─────────────
    const portfolioTimer = setInterval(() => {
      const survivors: Position[] = []
      let unrealized = 0

      for (const p of positionsRef.current) {
        // Mark each position against its OWN symbol's live price — no
        // more cross-pollinating BTC ticks into SOL positions.
        const price = marketsRef.current[p.symbol]?.price ?? p.markPrice
        const notional = p.sizeUsdt * p.leverage
        const change = (price - p.entryPrice) / p.entryPrice
        const pnl = (p.side === 'LONG' ? change : -change) * notional

        // SL / TP / liq checks → realise and close.
        const hitSL = p.side === 'LONG' ? price <= p.stopLoss : price >= p.stopLoss
        const hitTP = p.side === 'LONG' ? price >= p.takeProfit : price <= p.takeProfit

        if (hitSL || hitTP) {
          const realized = pnl
          cumulativeRealizedRef.current += realized
          closePosition(p.tradeId, realized, hitTP)
          pushLog({
            time: hhmmss(),
            module: 'EXEC',
            message: `Closed ${p.side} ${p.symbol} · ${hitTP ? 'TP' : 'SL'} · realised ${
              realized >= 0 ? '+' : ''
            }$${realized.toFixed(2)}`,
            type: hitTP ? 'SUCCESS' : 'WARNING',
          })
          continue
        }

        survivors.push({ ...p, markPrice: price, pnl })
        unrealized += pnl
      }

      positionsRef.current = survivors
      updatePositions(survivors, unrealized)

      // Hard stop-loss / kill switch — Spec §4.3.
      // Compare cumulative (realised + unrealised) vs the user's threshold.
      const cumulative = cumulativeRealizedRef.current + unrealized
      const killAt = -capitalRef.current * (ddRef.current / 100)
      if (capitalRef.current > 0 && cumulative <= killAt) {
        pushLog({
          time: hhmmss(),
          module: 'RISK',
          message: `CRITICAL · drawdown breach ${cumulative.toFixed(2)} ≤ ${killAt.toFixed(2)} · auto-terminating`,
          type: 'CRITICAL',
        })
        terminate()
      }
    }, 500)

    return () => {
      clearInterval(tickTimer)
      clearInterval(logTimer)
      clearInterval(obTimer)
      clearInterval(tradeTimer)
      clearInterval(portfolioTimer)
    }
    // We intentionally only restart the engine when lifecycle or resetNonce
    // changes — the dispatchers from context are stable identities, and
    // refs above carry fresh capital/risk/dd into each tick body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycle, resetNonce])

  // Boot greeting on every fresh deploy. Runs once per active session.
  useEffect(() => {
    if (lifecycle !== 'active') return
    pushLog({
      time: hhmmss(),
      module: 'PERC',
      message: `Engine online · capital $${allocatedCapital.toLocaleString()} · risk ${riskPerTrade.toFixed(1)}% · max ${maxPositionsFor(allocatedCapital)} parallel positions`,
      type: 'SUCCESS',
    })
    pushLog({
      time: hhmmss(),
      module: 'PERC',
      message: `Multi-market scanner armed → ${MARKETS.map((m) => m.symbol.replace('USDT', '')).join(' · ')}`,
      type: 'INFO',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycle, resetNonce])
}
