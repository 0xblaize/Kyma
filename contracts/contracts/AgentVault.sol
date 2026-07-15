// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal IERC20 surface (transfer/transferFrom/balanceOf).
/// @dev Inlined so the contract compiles in Remix with no imports.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// @title AgentVault — Kyma Terminal session vault with on-chain PnL settlement
/// @notice One session per user. User deposits native ETH or USDC, then every
///         agent action (Deploy / OpenTrade / CloseTrade / Terminate) is an
///         on-chain transaction.
///
///         Realized PnL on `closeTrade` is settled against a fixed `treasury`
///         address AUTOMATICALLY at close time:
///
///           • LOSS  → funds move OUT of the vault → treasury immediately.
///           • WIN   → funds move IN  from treasury → vault immediately.
///                     (USDC: treasury must have approved this vault.
///                      ETH:  drawn from the houseEth pool.)
///
///         On `terminate` all still-open trades are force-closed with PnL=0
///         (the agent should close positions before terminating), and the live
///         balance is refunded directly in the same transaction.
///
///         Owner cannot pull user funds under any circumstance.
contract AgentVault {

    // ─── Types ────────────────────────────────────────────────────────────
    enum SessionStatus { NONE, ACTIVE, PAUSED, TERMINATED }
    enum Side { LONG, SHORT }

    struct Session {
        address asset;           // address(0) == native ETH
        uint256 deposited;       // initial deposit (record only)
        uint256 balance;         // live balance after PnL settlement
        uint256 riskBps;         // basis points, 10..500
        uint256 maxDrawdownBps;  // basis points, 100..10_000
        uint256 profitTargetAmt; // raw token units — auto-terminate when hit (0 = disabled)
        SessionStatus status;
        uint64 deployedAt;
        uint64 terminatedAt;
    }

    struct Trade {
        bytes32 id;
        address owner;
        bytes32 symbol;
        Side side;
        uint256 sizeUsdt;
        uint256 entryPrice;
        uint256 stopLoss;
        uint256 takeProfit;
        bool open;
        uint64 openedAt;
        uint64 closedAt;
        int256 realizedPnl;  // set on close
    }

    // ─── Storage ──────────────────────────────────────────────────────────

    /// @notice Sink for losses, source for wins. Set once at construction.
    address public immutable treasury;

    /// @notice Pre-funded ETH liquidity used to pay out ETH-denominated wins.
    ///         Treasury operator funds it via `houseDepositETH()`.
    uint256 public houseEth;

    mapping(address => Session)    public sessions;
    mapping(bytes32 => Trade)      public trades;
    mapping(address => bytes32[])  private _userTradeIds;
    uint256 private _nonce;

    // ─── Events ───────────────────────────────────────────────────────────
    event Deployed(address indexed user, address asset, uint256 amount, uint256 riskBps, uint256 maxDdBps, uint256 profitTarget);
    event TradeOpened(bytes32 indexed id, address indexed user, bytes32 symbol, Side side, uint256 sizeUsdt, uint256 entry, uint256 sl, uint256 tp);
    event TradeClosed(bytes32 indexed id, address indexed user, uint256 exitPrice, int256 pnl, string reason);
    event LossSent(address indexed user, address asset, uint256 amount);
    event WinReceived(address indexed user, address asset, uint256 amount);
    event ProfitTargetHit(address indexed user, uint256 balance);
    event HouseDeposit(address indexed from, uint256 amount);
    event Paused(address indexed user);
    event Resumed(address indexed user);
    event Terminated(address indexed user, uint256 refunded);
    event Withdrawn(address indexed user, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────
    error NoActiveSession();
    error SessionAlreadyActive();
    error AssetMismatch();
    error AmountZero();
    error TradeNotOpen();
    error NotTradeOwner();
    error TransferFailed();
    error TreasuryZero();
    error InsufficientHouseLiquidity();
    error SessionNotTerminated();

    constructor(address _treasury) {
        if (_treasury == address(0)) revert TreasuryZero();
        treasury = _treasury;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────

    /// @dev Requires the caller to have an ACTIVE (not paused, not terminated) session.
    modifier onlyActive() {
        if (sessions[msg.sender].status != SessionStatus.ACTIVE) revert NoActiveSession();
        _;
    }

    /// @dev Requires the caller to have an ACTIVE or PAUSED session (for closeTrade during pause).
    modifier onlyLiveSession() {
        SessionStatus st = sessions[msg.sender].status;
        if (st != SessionStatus.ACTIVE && st != SessionStatus.PAUSED) revert NoActiveSession();
        _;
    }

    // ─── Treasury liquidity ───────────────────────────────────────────────

    /// @notice Pre-fund the vault with native ETH so ETH-denominated wins can
    ///         be paid out without an external call at close-time.
    function houseDepositETH() external payable {
        if (msg.value == 0) revert AmountZero();
        houseEth += msg.value;
        emit HouseDeposit(msg.sender, msg.value);
    }

    // ─── User actions: every one requires a wallet signature ──────────────

    /// @notice Open a session by depositing collateral.
    /// @param profitTarget Raw token amount at which the agent auto-terminates
    ///                     (e.g. 50_000_000 = $50 USDC at 6dp). Pass 0 to disable.
    function deploy(
        address asset,
        uint256 amount,
        uint256 riskBps,
        uint256 maxDdBps,
        uint256 profitTarget
    ) external payable {
        Session storage s = sessions[msg.sender];
        if (s.status == SessionStatus.ACTIVE) revert SessionAlreadyActive();
        if (amount == 0) revert AmountZero();

        if (asset == address(0)) {
            // ETH deposit
            if (msg.value != amount) revert AmountZero();
        } else {
            // ERC20 deposit
            if (msg.value != 0) revert AssetMismatch();
            bool ok = IERC20(asset).transferFrom(msg.sender, address(this), amount);
            if (!ok) revert TransferFailed();
        }

        sessions[msg.sender] = Session({
            asset:           asset,
            deposited:       amount,
            balance:         amount,
            riskBps:         riskBps,
            maxDrawdownBps:  maxDdBps,
            profitTargetAmt: profitTarget,
            status:          SessionStatus.ACTIVE,
            deployedAt:      uint64(block.timestamp),
            terminatedAt:    0
        });

        emit Deployed(msg.sender, asset, amount, riskBps, maxDdBps, profitTarget);
    }

    /// @notice Record a trade on-chain (called by the agent after AI approves).
    function openTrade(
        bytes32 symbol,
        Side side,
        uint256 sizeUsdt,
        uint256 entryPrice,
        uint256 stopLoss,
        uint256 takeProfit
    ) external onlyActive returns (bytes32 id) {
        id = keccak256(abi.encodePacked(msg.sender, ++_nonce, block.timestamp));
        trades[id] = Trade({
            id:          id,
            owner:       msg.sender,
            symbol:      symbol,
            side:        side,
            sizeUsdt:    sizeUsdt,
            entryPrice:  entryPrice,
            stopLoss:    stopLoss,
            takeProfit:  takeProfit,
            open:        true,
            openedAt:    uint64(block.timestamp),
            closedAt:    0,
            realizedPnl: 0
        });
        _userTradeIds[msg.sender].push(id);
        emit TradeOpened(id, msg.sender, symbol, side, sizeUsdt, entryPrice, stopLoss, takeProfit);
    }

    /// @notice Close a trade and AUTOMATICALLY SETTLE its PnL on-chain.
    ///
    ///         LOSS (pnl < 0):
    ///           The loss is transferred from the vault → treasury immediately.
    ///           The user's live balance shrinks by the loss amount.
    ///           Capped at the user's remaining balance so they never go negative.
    ///
    ///         WIN (pnl > 0):
    ///           The win is transferred from treasury → vault immediately.
    ///           USDC: requires treasury to have pre-approved this vault.
    ///           ETH:  drawn from the houseEth pool.
    ///           The user's live balance grows by the win amount.
    ///
    ///         After settlement, if the profit target is set and hit,
    ///         the session is auto-terminated and the balance refunded.
    ///
    /// @param pnl Signed PnL in the SAME raw token units as the deposited asset
    ///            (wei for ETH, 6-decimals for USDC). Negative = loss.
    function closeTrade(
        bytes32 id,
        uint256 exitPrice,
        int256  pnl,
        string calldata reason
    ) external onlyLiveSession {
        Trade storage t = trades[id];
        if (!t.open) revert TradeNotOpen();
        if (t.owner != msg.sender) revert NotTradeOwner();

        // Mark closed
        t.open        = false;
        t.closedAt    = uint64(block.timestamp);
        t.realizedPnl = pnl;

        Session storage s = sessions[msg.sender];
        address asset = s.asset;

        // ── LOSS: move funds vault → treasury ─────────────────────────────
        if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            uint256 take = loss > s.balance ? s.balance : loss;  // cap at balance
            if (take > 0) {
                s.balance -= take;
                _sendToTreasury(asset, take);
                emit LossSent(msg.sender, asset, take);
            }
        }
        // ── WIN: move funds treasury → vault ──────────────────────────────
        else if (pnl > 0) {
            uint256 win = uint256(pnl);
            _pullFromTreasury(asset, win);
            s.balance += win;
            emit WinReceived(msg.sender, asset, win);
        }

        emit TradeClosed(id, msg.sender, exitPrice, pnl, reason);

        // ── Profit target auto-terminate ──────────────────────────────────
        // If a profit target was set and the running balance has grown past it,
        // automatically close the session and refund the user immediately.
        if (
            s.profitTargetAmt > 0 &&
            s.balance >= s.deposited + s.profitTargetAmt &&
            s.status == SessionStatus.ACTIVE
        ) {
            emit ProfitTargetHit(msg.sender, s.balance);
            _terminateAndRefund(s);
            emit Terminated(msg.sender, s.balance); // balance already zeroed inside helper
        }
    }

    function pause() external onlyActive {
        sessions[msg.sender].status = SessionStatus.PAUSED;
        emit Paused(msg.sender);
    }

    function resume() external {
        Session storage s = sessions[msg.sender];
        if (s.status != SessionStatus.PAUSED) revert NoActiveSession();
        s.status = SessionStatus.ACTIVE;
        emit Resumed(msg.sender);
    }

    /// @notice Terminate the session. Any still-open trades are force-closed
    ///         at PnL=0 (no settlement — the agent should close them first).
    ///         The live balance is refunded to the depositor immediately.
    function terminate() external {
        Session storage s = sessions[msg.sender];
        if (s.status == SessionStatus.NONE || s.status == SessionStatus.TERMINATED)
            revert NoActiveSession();

        // Force-close any orphaned open trades (no PnL applied — agent should
        // have already settled them via closeTrade before calling terminate).
        bytes32[] storage ids = _userTradeIds[msg.sender];
        for (uint256 i = 0; i < ids.length; ++i) {
            Trade storage t = trades[ids[i]];
            if (t.open) {
                t.open     = false;
                t.closedAt = uint64(block.timestamp);
                emit TradeClosed(ids[i], msg.sender, 0, 0, "TERMINATE");
            }
        }

        uint256 refund = s.balance;
        _terminateAndRefund(s);
        emit Terminated(msg.sender, refund);
    }

    /// @notice Withdraw any remaining balance after termination.
    ///         Note: terminate() already refunds the balance in the same tx.
    ///         This function exists as a safety hatch if termination succeeded
    ///         but the ETH send failed (re-entrancy guard not needed — balance
    ///         is zeroed before the transfer).
    function withdraw() external {
        Session storage s = sessions[msg.sender];
        if (s.status != SessionStatus.TERMINATED) revert SessionNotTerminated();
        uint256 amt = s.balance;
        if (amt == 0) revert AmountZero();
        s.balance = 0;
        _payUser(s.asset, amt);
        emit Withdrawn(msg.sender, amt);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────

    /// @dev Mark session terminated and refund the live balance in one shot.
    ///      Balance is zeroed BEFORE the external call (CEI pattern).
    function _terminateAndRefund(Session storage s) internal {
        uint256 refund = s.balance;
        address asset  = s.asset;
        s.balance      = 0;
        s.status       = SessionStatus.TERMINATED;
        s.terminatedAt = uint64(block.timestamp);
        if (refund > 0) _payUser(asset, refund);
    }

    /// @dev Push `amount` of `asset` from vault to treasury.
    function _sendToTreasury(address asset, uint256 amount) internal {
        if (asset == address(0)) {
            (bool ok, ) = treasury.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            bool ok = IERC20(asset).transfer(treasury, amount);
            if (!ok) revert TransferFailed();
        }
    }

    /// @dev Pull `amount` of `asset` from treasury into vault.
    ///      USDC: treasury must have called USDC.approve(vaultAddress, MAX) first.
    ///      ETH:  drawn from the pre-funded houseEth pool (no external call).
    function _pullFromTreasury(address asset, uint256 amount) internal {
        if (asset == address(0)) {
            if (amount > houseEth) revert InsufficientHouseLiquidity();
            houseEth -= amount;
        } else {
            bool ok = IERC20(asset).transferFrom(treasury, address(this), amount);
            if (!ok) revert TransferFailed();
        }
    }

    /// @dev Pay `msg.sender` in `asset`. Balance zeroed before call (CEI pattern).
    function _payUser(address asset, uint256 amount) internal {
        if (asset == address(0)) {
            (bool ok, ) = msg.sender.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            bool ok = IERC20(asset).transfer(msg.sender, amount);
            if (!ok) revert TransferFailed();
        }
    }

    // ─── Views ────────────────────────────────────────────────────────────
    function getSession(address user) external view returns (Session memory) {
        return sessions[user];
    }
    function getTrade(bytes32 id) external view returns (Trade memory) {
        return trades[id];
    }
    function getTradeIds(address user) external view returns (bytes32[] memory) {
        return _userTradeIds[user];
    }
    function isActive(address user) external view returns (bool) {
        return sessions[user].status == SessionStatus.ACTIVE;
    }
    function liveBalance(address user) external view returns (uint256) {
        return sessions[user].balance;
    }

    // ─── Safety ───────────────────────────────────────────────────────────
    // Direct ETH sends without calling deploy() or houseDepositETH() are
    // rejected so accidental transfers can never get stuck.
    receive()  external payable { revert("use deploy() or houseDepositETH()"); }
    fallback() external payable { revert("unknown selector"); }
}
