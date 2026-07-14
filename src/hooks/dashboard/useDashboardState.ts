'use client'

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'

// Lifecycle (Spec §4.4 / §7.4):
//   idle       — no Deploy yet; sidebar configurable; 3D agent sits idle
//   active     — Deploy pressed; mock feeds running; 3D agent typing
//   paused     — pause perception; feeds halt; 3D back to idle; PNL frozen
//   terminated — kill switch; feeds stop permanently; 3D frozen "dead" frame
export type AgentLifecycle = 'idle' | 'active' | 'paused' | 'terminated'

// ──────────────────────────────────────────────────────────────────────────
// Vol.2 §2 WebSocket payload shapes — kept identical so a real backend can
// drop in without panel refactors. The mock engine emits these exact shapes.
// ──────────────────────────────────────────────────────────────────────────

export type LogModule = 'PERC' | 'SMC' | 'RISK' | 'EXEC'
export type LogType = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL'

export interface TerminalLog {
  id: number              // monotonic, used as React key
  time: string            // HH:MM:SS
  module: LogModule
  message: string
  type: LogType
}

export interface OrderBlock {
  id: number
  priceLevel: number
  direction: 'BULLISH' | 'BEARISH'
  asset: string
  createdAt: number       // ms epoch — for fade/expiry
}

// Position sizing tier. BASE = standard risk%. AGGRESSIVE = bot expects a
// drawdown before the move pumps, so it commits more notional and widens SL
// to weather the regression instead of getting wicked out.
export type RiskTier = 'BASE' | 'AGGRESSIVE'

export interface Position {
  tradeId: string
  symbol: string
  side: 'LONG' | 'SHORT'
  sizeUsdt: number
  qty: number             // base-asset units entered (e.g. 0.0123 BTC, 5.42 SOL)
  leverage: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  liqPrice: number
  riskTier: RiskTier
  // Live fields updated by portfolio ticks:
  markPrice: number
  pnl: number             // unrealized USDT
}

export type SelectedAsset = 'ETH' | 'USDC'

// On-chain tx phase shown next to the Deploy/Terminate buttons.
//   idle      — no pending tx
//   approving — ERC20 approve in progress (USDC path only)
//   signing   — waiting for wallet signature on the vault call
//   pending   — submitted, waiting for receipt
//   error     — last tx failed; lifecycle does NOT advance
export type TxPhase = 'idle' | 'approving' | 'signing' | 'pending' | 'error'

interface DashboardState {
  // Lifecycle
  lifecycle: AgentLifecycle
  // Asset chosen for allocated capital (drives MAX + decimals).
  selectedAsset: SelectedAsset
  // Top 10 Crypto market chosen.
  selectedMarket: string
  // On-chain tx tracking (drives button labels / disabled state).
  txPhase: TxPhase
  txHash: string | null
  txError: string | null
  // Configuration (Spec §4.1–§4.3)
  allocatedCapital: number     // amount in selectedAsset units (ETH or USDC)
  riskPerTrade: number          // percent, 0.1..5.0
  maxDrawdownPct: number        // percent, kill-switch threshold
  // Market & AI state (fed by useMockEngine — Vol.2 §1.1)
  currentPrice: number
  terminalLogs: TerminalLog[]
  activeOrderBlocks: OrderBlock[]
  openPositions: Position[]
  realizedPnl: number
  unrealizedPnl: number
  winRate: number                // 0..100
  closedTradeCount: number
  winCount: number
  peakEquity: number             // running max, for max-drawdown card
  maxDrawdown: number            // most negative excursion (USDT, ≤ 0)
  // Counters consumed by mock generators / terminal to re-seed or clear
  resetNonce: number
  flushNonce: number
}

type Action =
  | { type: 'SET_CAPITAL'; value: number }
  | { type: 'SET_RISK'; value: number }
  | { type: 'SET_DRAWDOWN'; value: number }
  | { type: 'SET_ASSET'; value: SelectedAsset }
  | { type: 'SET_MARKET'; value: string }
  | { type: 'TX_PHASE'; phase: TxPhase; hash?: string | null; error?: string | null }
  | { type: 'DEPLOY' }
  | { type: 'TOGGLE_PAUSED' }
  | { type: 'TERMINATE' }
  | { type: 'FLUSH' }
  | { type: 'RESET' }
  // Feed actions
  | { type: 'TICK'; price: number }
  | { type: 'PUSH_LOG'; log: Omit<TerminalLog, 'id'> }
  | { type: 'ADD_ORDER_BLOCK'; ob: Omit<OrderBlock, 'id'> }
  | { type: 'OPEN_POSITION'; position: Position }
  | { type: 'CLOSE_POSITION'; tradeId: string; realized: number; wasWin: boolean }
  | { type: 'UPDATE_POSITIONS'; positions: Position[]; unrealized: number }

const initial: DashboardState = {
  lifecycle: 'idle',
  selectedAsset: 'USDC',
  selectedMarket: 'BTCUSDT',
  txPhase: 'idle',
  txHash: null,
  txError: null,
  allocatedCapital: 0,
  riskPerTrade: 1.0,
  maxDrawdownPct: 10,
  currentPrice: 0,
  terminalLogs: [],
  activeOrderBlocks: [],
  openPositions: [],
  realizedPnl: 0,
  unrealizedPnl: 0,
  winRate: 0,
  closedTradeCount: 0,
  winCount: 0,
  peakEquity: 0,
  maxDrawdown: 0,
  resetNonce: 0,
  flushNonce: 0,
}

// Monotonic counters live outside React state so they survive even when we
// trim arrays — and so we never clash keys after a flush.
let nextLogId = 1
let nextObId = 1

const MAX_LOGS = 100
const MAX_ORDER_BLOCKS = 8     // chart gets noisy beyond this — drop oldest

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'SET_CAPITAL':
      return { ...state, allocatedCapital: Math.max(0, action.value) }
    case 'SET_RISK':
      return { ...state, riskPerTrade: clamp(action.value, 0.1, 5.0) }
    case 'SET_DRAWDOWN':
      return { ...state, maxDrawdownPct: clamp(action.value, 1, 100) }
    case 'SET_ASSET':
      // Switching asset resets allocated capital — units differ (1.0 ETH ≠ 1.0 USDC).
      // Locked once a session is live so we don't desync UI from the on-chain vault.
      if (state.lifecycle !== 'idle') return state
      return { ...state, selectedAsset: action.value, allocatedCapital: 0 }
    case 'SET_MARKET':
      if (state.lifecycle !== 'idle') return state
      return { ...state, selectedMarket: action.value }
    case 'TX_PHASE':
      return {
        ...state,
        txPhase: action.phase,
        txHash: action.hash ?? state.txHash,
        txError: action.error ?? (action.phase === 'error' ? state.txError : null),
      }
    case 'DEPLOY':
      // Only deploy from idle; ignored otherwise so the button can stay wired
      // to the same handler regardless of state.
      if (state.lifecycle !== 'idle') return state
      return { ...state, lifecycle: 'active', peakEquity: state.allocatedCapital }
    case 'TOGGLE_PAUSED':
      if (state.lifecycle === 'active') return { ...state, lifecycle: 'paused' }
      if (state.lifecycle === 'paused') return { ...state, lifecycle: 'active' }
      return state
    case 'TERMINATE':
      // Toggle: terminate when running, reset to idle when already terminated.
      // When terminating from active/paused we realise all open positions —
      // Spec §7.4 "calculates a final realized PNL".
      if (state.lifecycle === 'terminated') {
        return { ...initial, resetNonce: state.resetNonce + 1 }
      }
      return {
        ...state,
        lifecycle: 'terminated',
        realizedPnl: state.realizedPnl + state.unrealizedPnl,
        unrealizedPnl: 0,
        openPositions: [],
      }
    case 'FLUSH':
      return { ...state, terminalLogs: [], flushNonce: state.flushNonce + 1 }
    case 'RESET':
      // Spec §7.3: hard reset — capital input clears, PNL resets, lifecycle
      // back to idle so Deploy can be pressed again.
      return {
        ...initial,
        resetNonce: state.resetNonce + 1,
        flushNonce: state.flushNonce + 1,
      }

    // ── Feed actions ──────────────────────────────────────────────────────
    case 'TICK':
      return { ...state, currentPrice: action.price }
    case 'PUSH_LOG': {
      const log: TerminalLog = { ...action.log, id: nextLogId++ }
      const logs = state.terminalLogs.length >= MAX_LOGS
        ? [...state.terminalLogs.slice(state.terminalLogs.length - MAX_LOGS + 1), log]
        : [...state.terminalLogs, log]
      return { ...state, terminalLogs: logs }
    }
    case 'ADD_ORDER_BLOCK': {
      const ob: OrderBlock = { ...action.ob, id: nextObId++ }
      const arr = state.activeOrderBlocks.length >= MAX_ORDER_BLOCKS
        ? [...state.activeOrderBlocks.slice(1), ob]
        : [...state.activeOrderBlocks, ob]
      return { ...state, activeOrderBlocks: arr }
    }
    case 'OPEN_POSITION':
      return { ...state, openPositions: [...state.openPositions, action.position] }
    case 'CLOSE_POSITION': {
      const closed = state.openPositions.find((p) => p.tradeId === action.tradeId)
      if (!closed) return state
      const realizedPnl = state.realizedPnl + action.realized
      const winCount = state.winCount + (action.wasWin ? 1 : 0)
      const closedTradeCount = state.closedTradeCount + 1
      const winRate = closedTradeCount === 0 ? 0 : (winCount / closedTradeCount) * 100
      // Equity-curve max-drawdown bookkeeping: track peak, then track the
      // deepest dip from peak in $.
      const equity = state.allocatedCapital + realizedPnl
      const peakEquity = Math.max(state.peakEquity, equity)
      const dipFromPeak = equity - peakEquity   // ≤ 0
      const maxDrawdown = Math.min(state.maxDrawdown, dipFromPeak)
      return {
        ...state,
        openPositions: state.openPositions.filter((p) => p.tradeId !== action.tradeId),
        realizedPnl,
        winRate,
        winCount,
        closedTradeCount,
        peakEquity,
        maxDrawdown,
      }
    }
    case 'UPDATE_POSITIONS':
      return {
        ...state,
        openPositions: action.positions,
        unrealizedPnl: action.unrealized,
      }
    default:
      return state
  }
}

function clamp(v: number, lo: number, hi: number) {
  if (Number.isNaN(v)) return lo
  return Math.min(hi, Math.max(lo, v))
}

interface DashboardContextValue extends DashboardState {
  // Derived booleans used by panels — cheaper than recomputing everywhere.
  paused: boolean
  terminated: boolean
  active: boolean
  cumulativePnl: number           // realized + unrealized (Spec §6.1 card)
  openLongCount: number
  openShortCount: number
  // Config actions
  setAllocatedCapital: (v: number) => void
  setRiskPerTrade: (v: number) => void
  setMaxDrawdownPct: (v: number) => void
  setSelectedAsset: (v: SelectedAsset) => void
  setSelectedMarket: (v: string) => void
  // Tx tracking
  setTxPhase: (phase: TxPhase, hash?: string | null, error?: string | null) => void
  // Lifecycle actions
  deployAgent: () => void
  togglePaused: () => void
  terminate: () => void
  flushLogs: () => void
  resetSimulation: () => void
  // Feed actions (consumed by useMockEngine)
  pushTick: (price: number) => void
  pushLog: (log: Omit<TerminalLog, 'id'>) => void
  pushOrderBlock: (ob: Omit<OrderBlock, 'id'>) => void
  openPosition: (p: Position) => void
  closePosition: (tradeId: string, realized: number, wasWin: boolean) => void
  updatePositions: (positions: Position[], unrealized: number) => void
}

const Ctx = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)

  const setAllocatedCapital = useCallback((value: number) => dispatch({ type: 'SET_CAPITAL', value }), [])
  const setRiskPerTrade = useCallback((value: number) => dispatch({ type: 'SET_RISK', value }), [])
  const setMaxDrawdownPct = useCallback((value: number) => dispatch({ type: 'SET_DRAWDOWN', value }), [])
  const setSelectedAsset = useCallback((value: SelectedAsset) => dispatch({ type: 'SET_ASSET', value }), [])
  const setSelectedMarket = useCallback((value: string) => dispatch({ type: 'SET_MARKET', value }), [])
  const setTxPhase = useCallback(
    (phase: TxPhase, hash?: string | null, error?: string | null) =>
      dispatch({ type: 'TX_PHASE', phase, hash, error }),
    [],
  )
  const deployAgent = useCallback(() => dispatch({ type: 'DEPLOY' }), [])
  const togglePaused = useCallback(() => dispatch({ type: 'TOGGLE_PAUSED' }), [])
  const terminate = useCallback(() => dispatch({ type: 'TERMINATE' }), [])
  const flushLogs = useCallback(() => dispatch({ type: 'FLUSH' }), [])
  const resetSimulation = useCallback(() => dispatch({ type: 'RESET' }), [])

  const pushTick = useCallback((price: number) => dispatch({ type: 'TICK', price }), [])
  const pushLog = useCallback((log: Omit<TerminalLog, 'id'>) => dispatch({ type: 'PUSH_LOG', log }), [])
  const pushOrderBlock = useCallback(
    (ob: Omit<OrderBlock, 'id'>) => dispatch({ type: 'ADD_ORDER_BLOCK', ob }),
    [],
  )
  const openPosition = useCallback((p: Position) => dispatch({ type: 'OPEN_POSITION', position: p }), [])
  const closePosition = useCallback(
    (tradeId: string, realized: number, wasWin: boolean) =>
      dispatch({ type: 'CLOSE_POSITION', tradeId, realized, wasWin }),
    [],
  )
  const updatePositions = useCallback(
    (positions: Position[], unrealized: number) =>
      dispatch({ type: 'UPDATE_POSITIONS', positions, unrealized }),
    [],
  )

  const value = useMemo<DashboardContextValue>(
    () => {
      const openLongCount = state.openPositions.filter((p) => p.side === 'LONG').length
      return {
        ...state,
        paused: state.lifecycle === 'paused',
        terminated: state.lifecycle === 'terminated',
        active: state.lifecycle === 'active',
        cumulativePnl: state.realizedPnl + state.unrealizedPnl,
        openLongCount,
        openShortCount: state.openPositions.length - openLongCount,
        setAllocatedCapital,
        setRiskPerTrade,
        setMaxDrawdownPct,
        setSelectedAsset,
        setSelectedMarket,
        setTxPhase,
        deployAgent,
        togglePaused,
        terminate,
        flushLogs,
        resetSimulation,
        pushTick,
        pushLog,
        pushOrderBlock,
        openPosition,
        closePosition,
        updatePositions,
      }
    },
    [
      state,
      setAllocatedCapital,
      setRiskPerTrade,
      setMaxDrawdownPct,
      setSelectedAsset,
      setSelectedMarket,
      setTxPhase,
      deployAgent,
      togglePaused,
      terminate,
      flushLogs,
      resetSimulation,
      pushTick,
      pushLog,
      pushOrderBlock,
      openPosition,
      closePosition,
      updatePositions,
    ],
  )

  return createElement(Ctx.Provider, { value }, children)
}

export function useDashboardState(): DashboardContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDashboardState must be used within DashboardProvider')
  return v
}
