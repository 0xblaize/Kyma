// AgentVault ABI — mirrors contracts/AgentVault.sol. Keep in sync.
// `as const` is required so wagmi/viem infer the function signatures.

export const agentVaultAbi = [
  // ── constructor (for reference; viem ignores) ───────────────────────
  {
    type: 'constructor',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_treasury', type: 'address' }],
  },
  // ── treasury liquidity ──────────────────────────────────────────────
  {
    type: 'function',
    name: 'houseDepositETH',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'treasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'houseEth',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // ── deploy ───────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'deploy',
    stateMutability: 'payable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'riskBps', type: 'uint256' },
      { name: 'maxDdBps', type: 'uint256' },
    ],
    outputs: [],
  },
  // ── openTrade ────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'openTrade',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'symbol', type: 'bytes32' },
      { name: 'side', type: 'uint8' },
      { name: 'sizeUsdt', type: 'uint256' },
      { name: 'entryPrice', type: 'uint256' },
      { name: 'stopLoss', type: 'uint256' },
      { name: 'takeProfit', type: 'uint256' },
    ],
    outputs: [{ name: 'id', type: 'bytes32' }],
  },
  // ── closeTrade ───────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'closeTrade',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'exitPrice', type: 'uint256' },
      { name: 'pnl', type: 'int256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
  // ── pause / resume / terminate / withdraw ───────────────────────────
  { type: 'function', name: 'pause',     stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'resume',    stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'terminate', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'withdraw',  stateMutability: 'nonpayable', inputs: [], outputs: [] },
  // ── views ────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getSession',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'asset', type: 'address' },
          { name: 'deposited', type: 'uint256' },
          { name: 'balance', type: 'uint256' },
          { name: 'riskBps', type: 'uint256' },
          { name: 'maxDrawdownBps', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'deployedAt', type: 'uint64' },
          { name: 'terminatedAt', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'isActive',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  // ── events ───────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'Deployed',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'riskBps', type: 'uint256', indexed: false },
      { name: 'maxDdBps', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TradeOpened',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'symbol', type: 'bytes32', indexed: false },
      { name: 'side', type: 'uint8', indexed: false },
      { name: 'sizeUsdt', type: 'uint256', indexed: false },
      { name: 'entry', type: 'uint256', indexed: false },
      { name: 'sl', type: 'uint256', indexed: false },
      { name: 'tp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TradeClosed',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'exitPrice', type: 'uint256', indexed: false },
      { name: 'pnl', type: 'int256', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Terminated',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'refunded', type: 'uint256', indexed: false },
    ],
  },
  // ── settlement events: surfaced so dashboards / explorers can show
  //    exactly where each tx's PnL went.
  {
    type: 'event',
    name: 'LossSent',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WinReceived',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'HouseDeposit',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

// Minimal ERC20 ABI we need: approve, allowance, balanceOf, decimals.
export const erc20Abi = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'who', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }] },
] as const

export type TradeSideOnChain = 0 | 1 // 0 = LONG, 1 = SHORT
export type SessionStatusOnChain = 0 | 1 | 2 | 3 // NONE | ACTIVE | PAUSED | TERMINATED
