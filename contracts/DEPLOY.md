# AgentVault — Base Sepolia Deploy Guide (≈ 5 min)

v1 of Agent.OS ships with **Base Sepolia only**. Other testnets are commented
out in `src/lib/wagmi.ts` — uncomment if you want to bring them back later.

The vault now settles trade PnL on-chain against a **treasury** address:

- **Losses** leave the vault and arrive at `treasury`.
- **Wins** are paid out FROM `treasury` (USDC via `transferFrom`; ETH via the
  pre-funded `houseEth` pool).

So before users can win, you have to load the pump. The two stages below
cover both the deploy and the load.

## 1. Deploy the contract

1. Open https://remix.ethereum.org
2. Create `AgentVault.sol` and paste the contents of `contracts/AgentVault.sol`.
3. **Compiler tab** → Solidity **0.8.24**, EVM **default**, optimization on,
   runs 200 → **Compile**.
4. **Deploy & Run tab**:
   - Environment: **Injected Provider — MetaMask**.
   - Switch MetaMask to **Base Sepolia (chain id 84532)**. If not in your
     network list yet: https://chainlist.org/chain/84532 → Add to MetaMask.
   - Account: any funded Base Sepolia account.
   - Contract: `AgentVault`.
   - In the input next to **Deploy**, paste the **treasury address** — this
     is where losses will land and where wins will be paid from. Your own
     wallet works for a demo.
   - Click **Deploy**, approve the MetaMask tx.
5. Copy the deployed contract address.

## 2. Load the win pump

The treasury must fund the vault so wins can be paid out. Switch MetaMask
to the **treasury** account before each step below.

### ETH wins — `houseDepositETH()`

From Remix's deployed-contract panel:

1. In the top **VALUE** field, type the amount of ETH to reserve for wins
   (e.g. `0.05`) and select **Ether** as the unit.
2. Click the orange **houseDepositETH** button. Approve the tx.

That ETH now lives in `houseEth` and can only leave the vault as a win
payout to a user (or as a refund of leftover balance on terminate).

### USDC wins — `approve` on the USDC contract

The treasury doesn't pre-deposit USDC. Instead it gives the vault an
allowance, and the vault pulls USDC at win-time via `transferFrom`.

1. Open the Base Sepolia USDC contract on BaseScan:
   https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e#writeContract
2. **Connect to Web3** with the **treasury** account.
3. Call `approve(spender, amount)`:
   - `spender` = the `AgentVault` address you just deployed.
   - `amount` = max USDC the pump can ever pay out. For 1000 USDC, use
     `1000000000` (USDC has 6 decimals on Base).
4. Send the tx.

The dashboard's **Settlement** card (right sidebar) reads
`allowance(treasury, vault)` live, so that number is what the user sees as
"Win pump · USDC".

## 3. Wire the address into the dashboard

At the project root in `.env.local`:

```
NEXT_PUBLIC_VAULT_BASE_SEPOLIA=0x...
```

Restart the dev server (`npm run dev`) so Next.js picks up the env var.

## Faucets you'll need

- **Base Sepolia ETH (for gas + houseDepositETH)** — https://www.alchemy.com/faucets/base-sepolia
- **Base Sepolia USDC (for treasury to approve)** — https://faucet.circle.com (pick Base Sepolia)
  - Token address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals)

## How signatures actually work end-to-end

Every dashboard action triggers a vault tx:

| Dashboard action     | Vault call                                        |
|----------------------|---------------------------------------------------|
| Deploy Agent (ETH)   | `deploy(0x0, amount, riskBps, maxDdBps)` (payable)|
| Deploy Agent (USDC)  | `approve(vault, amount)` then `deploy(...)`       |
| Open Trade           | `openTrade(symbol, side, size, entry, sl, tp)`    |
| Close Trade          | `closeTrade(id, exitPrice, pnl, reason)`          |
| Pause Perception     | `pause()`                                         |
| Resume Perception    | `resume()`                                        |
| Terminate Agent      | `terminate()` (refunds the live balance)          |
| Withdraw (post-term) | `withdraw()`                                      |

`closeTrade(pnl)` is where PnL settles against the treasury:

- `pnl < 0` → vault sends `min(|pnl|, balance)` to `treasury`, user balance
  shrinks.
- `pnl > 0` → vault pulls `pnl` from `treasury` (USDC: `transferFrom`; ETH:
  drawn from `houseEth`), user balance grows.

`pnl` is in the **same raw units as the deposit asset** (wei for ETH, 6dp
for USDC). The hook `useVaultActions().closeTrade(id, exitPrice, pnl, reason)`
in `src/hooks/dashboard/useVaultActions.ts` is the wired entry point.

ERC20 path is two popups on the first deploy; allowance is reused after
that until the user terminates and starts a new session.

## Optional: verify on BaseScan

For judging credit, after deploying:

1. Go to your contract page on https://sepolia.basescan.org
2. **Contract → Verify and Publish** → Single file, Solidity 0.8.24, MIT.
3. Paste the source from `contracts/AgentVault.sol`.
4. **Constructor args**: ABI-encode the treasury address. BaseScan's verify
   page has a helper — paste the treasury address and it returns the
   encoded bytes (a 64-hex-char string). Drop that into the constructor-args
   field at the bottom of the verify form.
