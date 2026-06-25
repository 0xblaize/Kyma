// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal IERC20 surface (transfer/transferFrom/balanceOf).
/// @dev Inlined so the contract compiles in Remix with no imports.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// @title AgentVault — Agent.OS session vault with on-chain PnL settlement
/// @notice One session per user. User deposits native ETH or USDC, then every
///         agent action (Deploy / OpenTrade / CloseTrade / Terminate) is an
///         on-chain transaction.
///
///         Realized PnL on `closeTrade` is settled against a fixed `treasury`
///         address:
///           - Losses leave the vault: amount is transferred OUT to treasury
///             and the user's live balance shrinks.
///           - Wins enter the vault:   amount is transferred IN from treasury
///             (ERC20: transferFrom; ETH: drawn from the pre-funded houseEth
///             pool) and the user's live balance grows.
///
///         On `terminate` / `withdraw` the live balance is refunded to the
///         depositor — so a net winner walks away with more than they put in
///         and a net loser walks away with less. Owner cannot pull funds.
contract AgentVault {
    // ─── Types ────────────────────────────────────────────────────────────
    enum SessionStatus { NONE, ACTIVE, PAUSED, TERMINATED }
    enum Side { LONG, SHORT }

    struct Session {
        address asset;          // address(0) == native ETH
        uint256 deposited;      // initial deposit (record only — never mutated)
        uint256 balance;        // live balance after PnL settlement
        uint256 riskBps;        // basis points, 10..500
        uint256 maxDrawdownBps; // basis points, 100..10_000
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
    }

    // ─── Storage ──────────────────────────────────────────────────────────

    /// @notice Sink for losses, source for wins. Set once at construction.
    address public immutable treasury;

    /// @notice Pre-funded ETH liquidity used to pay out ETH-denominated wins.
    ///         Treasury operator funds it via `houseDepositETH()`.
    uint256 public houseEth;

    mapping(address => Session) public sessions;
    mapping(bytes32 => Trade) public trades;
    mapping(address => bytes32[]) private _userTradeIds;
    uint256 private _nonce;

    // ─── Events ───────────────────────────────────────────────────────────
    event Deployed(address indexed user, address asset, uint256 amount, uint256 riskBps, uint256 maxDdBps);
    event TradeOpened(bytes32 indexed id, address indexed user, bytes32 symbol, Side side, uint256 sizeUsdt, uint256 entry, uint256 sl, uint256 tp);
    event TradeClosed(bytes32 indexed id, address indexed user, uint256 exitPrice, int256 pnl, string reason);
    event LossSent(address indexed user, address asset, uint256 amount);
    event WinReceived(address indexed user, address asset, uint256 amount);
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

    constructor(address _treasury) {
        if (_treasury == address(0)) revert TreasuryZero();
        treasury = _treasury;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────
    modifier onlyActive() {
        if (sessions[msg.sender].status != SessionStatus.ACTIVE) revert NoActiveSession();
        _;
    }

    // ─── Treasury liquidity ───────────────────────────────────────────────

    /// @notice Pre-fund the vault with native ETH so ETH-denominated wins can
    ///         be paid out without an external call at close-time. Anyone can
    ///         call (treasury operator typically does), and the funds become
    ///         part of `houseEth` — separate accounting from user deposits.
    function houseDepositETH() external payable {
        if (msg.value == 0) revert AmountZero();
        houseEth += msg.value;
        emit HouseDeposit(msg.sender, msg.value);
    }

    // ─── User actions: every one of these requires a wallet signature ────

    /// @notice Open a session by depositing collateral.
    function deploy(
        address asset,
        uint256 amount,
        uint256 riskBps,
        uint256 maxDdBps
    ) external payable {
        Session storage s = sessions[msg.sender];
        if (s.status == SessionStatus.ACTIVE) revert SessionAlreadyActive();
        if (amount == 0) revert AmountZero();

        if (asset == address(0)) {
            if (msg.value != amount) revert AmountZero();
        } else {
            if (msg.value != 0) revert AssetMismatch();
            bool ok = IERC20(asset).transferFrom(msg.sender, address(this), amount);
            if (!ok) revert TransferFailed();
        }

        sessions[msg.sender] = Session({
            asset: asset,
            deposited: amount,
            balance: amount,
            riskBps: riskBps,
            maxDrawdownBps: maxDdBps,
            status: SessionStatus.ACTIVE,
            deployedAt: uint64(block.timestamp),
            terminatedAt: 0
        });

        emit Deployed(msg.sender, asset, amount, riskBps, maxDdBps);
    }

    /// @notice Record an Order-Block-triggered trade on-chain.
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
            id: id,
            owner: msg.sender,
            symbol: symbol,
            side: side,
            sizeUsdt: sizeUsdt,
            entryPrice: entryPrice,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            open: true,
            openedAt: uint64(block.timestamp),
            closedAt: 0
        });
        _userTradeIds[msg.sender].push(id);
        emit TradeOpened(id, msg.sender, symbol, side, sizeUsdt, entryPrice, stopLoss, takeProfit);
    }

    /// @notice Close a trade and SETTLE its PnL on-chain.
    /// @param  pnl Signed PnL in the SAME raw token units as the deposited
    ///             asset (wei for ETH, 6dp for USDC, etc.). Negative = loss.
    /// @dev    Losses are sent to `treasury`, capped at the user's live balance
    ///         so a single bad trade can drain to zero but never go negative.
    ///         Wins are pulled from `treasury` (ERC20: requires prior approval;
    ///         ETH: drawn from `houseEth`).
    function closeTrade(bytes32 id, uint256 exitPrice, int256 pnl, string calldata reason) external {
        Trade storage t = trades[id];
        if (!t.open) revert TradeNotOpen();
        if (t.owner != msg.sender) revert NotTradeOwner();
        t.open = false;
        t.closedAt = uint64(block.timestamp);

        Session storage s = sessions[msg.sender];
        address asset = s.asset;

        if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            uint256 take = loss > s.balance ? s.balance : loss;
            if (take > 0) {
                s.balance -= take;
                _sendToTreasury(asset, take);
                emit LossSent(msg.sender, asset, take);
            }
        } else if (pnl > 0) {
            uint256 win = uint256(pnl);
            _pullFromTreasury(asset, win);
            s.balance += win;
            emit WinReceived(msg.sender, asset, win);
        }

        emit TradeClosed(id, msg.sender, exitPrice, pnl, reason);
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

    /// @notice Terminate the session. Abandons any still-open trades (no PnL
    ///         applied to them) and refunds the live balance to the depositor.
    function terminate() external {
        Session storage s = sessions[msg.sender];
        if (s.status == SessionStatus.NONE || s.status == SessionStatus.TERMINATED) revert NoActiveSession();

        bytes32[] storage ids = _userTradeIds[msg.sender];
        for (uint256 i = 0; i < ids.length; ++i) {
            Trade storage t = trades[ids[i]];
            if (t.open) {
                t.open = false;
                t.closedAt = uint64(block.timestamp);
                emit TradeClosed(ids[i], msg.sender, 0, 0, "TERMINATE");
            }
        }

        uint256 refund = s.balance;
        address asset = s.asset;
        s.balance = 0;
        s.status = SessionStatus.TERMINATED;
        s.terminatedAt = uint64(block.timestamp);

        if (refund > 0) _payUser(asset, refund);

        emit Terminated(msg.sender, refund);
    }

    function withdraw() external {
        Session storage s = sessions[msg.sender];
        if (s.status != SessionStatus.TERMINATED) revert NoActiveSession();
        uint256 amt = s.balance;
        if (amt == 0) revert AmountZero();
        s.balance = 0;
        _payUser(s.asset, amt);
        emit Withdrawn(msg.sender, amt);
    }

    // ─── Internal settlement helpers ──────────────────────────────────────

    function _sendToTreasury(address asset, uint256 amount) internal {
        if (asset == address(0)) {
            (bool ok, ) = treasury.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            bool ok = IERC20(asset).transfer(treasury, amount);
            if (!ok) revert TransferFailed();
        }
    }

    function _pullFromTreasury(address asset, uint256 amount) internal {
        if (asset == address(0)) {
            // ETH wins are drawn from the pre-funded house pool — no external
            // call needed, the ETH already lives in this contract.
            if (amount > houseEth) revert InsufficientHouseLiquidity();
            houseEth -= amount;
        } else {
            bool ok = IERC20(asset).transferFrom(treasury, address(this), amount);
            if (!ok) revert TransferFailed();
        }
    }

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
    function getTradeIds(address user) external view returns (bytes32[] memory) {
        return _userTradeIds[user];
    }
    function isActive(address user) external view returns (bool) {
        return sessions[user].status == SessionStatus.ACTIVE;
    }

    // Native ETH safety — direct sends without calling deploy() or
    // houseDepositETH() are rejected so accidental transfers don't get stuck.
    receive() external payable { revert("use deploy() or houseDepositETH()"); }
    fallback() external payable { revert("unknown selector"); }
}
