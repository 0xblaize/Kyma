# Agent.OS — Final Submission Checklist

**#BitgetHackathon — Shipping Mode**

> Do not touch the code further. You are in shipping mode now. Every minute spent "polishing" is a minute not spent on the demo recording, deployment, or submission form. Stay disciplined.

---

## Step 0 — The Failsafe (env config)

Before recording or deploying, make sure the demo cannot crash mid-presentation.

- [ ] `.env.local` exists at project root
- [ ] `NEXT_PUBLIC_WC_PROJECT_ID` is set (or accept injected-only / MetaMask flow)
- [ ] At least ONE vault address is filled in so a Deploy button is live:
  - [ ] `NEXT_PUBLIC_VAULT_SEPOLIA`
  - [ ] `NEXT_PUBLIC_VAULT_BASE_SEPOLIA`
  - [ ] `NEXT_PUBLIC_VAULT_BSC_TESTNET`
  - [ ] `NEXT_PUBLIC_VAULT_MORPH_HOLESKY`
- [ ] Wallet has testnet ETH + USDC on the chain you plan to demo
- [ ] USDC `approve(vault, amount)` already done on demo chain (skips one popup during recording)
- [ ] `npm run build` succeeds locally with zero errors
- [ ] `npm run start` serves the built app and `/dashboard` loads clean

---

## Step 1 — The Recording (90 seconds)

Follow this script. Do not improvise — the clock is unforgiving.

- [ ] **0:00–0:10 — Hook.** Open landing page. Scroll through the 6-phase cinematic (intro → morph → data → shadows → fusion → cta). Let the mannequin assemble.
- [ ] **0:10–0:20 — Pitch.** One sentence: *"Agent.OS is autonomous trading intelligence — every action signed on-chain across four EVM testnets."*
- [ ] **0:20–0:30 — Get Started.** Click CTA → route to `/dashboard`. Connect wallet (MetaMask). Show chain switcher.
- [ ] **0:30–0:50 — Deploy Agent.** Configure asset + risk in sidebar. Hit **Deploy**. Sign the two popups (approve + deploy). Show vault session opening on-chain.
- [ ] **0:50–1:10 — Live cockpit.** Reasoning terminal types. SMC chart updates. Positions ledger fills as the mock engine emits trades. Pan the 3D agent viewport once.
- [ ] **1:10–1:25 — Control.** Hit **Pause** → sign. Hit **Resume** → sign. Show feeds halt and restart.
- [ ] **1:25–1:30 — Terminate.** Hit **Terminate Agent** → sign. Vault refunds. End on the "session closed" state.

Recording tips:
- [ ] Browser zoom at 100%
- [ ] DevTools closed
- [ ] No browser notifications / Slack / Discord popups
- [ ] OBS or Loom in 1080p, 30fps minimum
- [ ] Re-record if any popup hangs >5 seconds

---

## Step 2 — The Final Push (deploy + submit)

- [ ] `git status` clean (no stray uncommitted experiments)
- [ ] `git add` only the files you intend to ship
- [ ] `git commit -m "chore: final hackathon submission"`
- [ ] `git push origin main`
- [ ] Vercel project linked to repo
- [ ] All `NEXT_PUBLIC_*` env vars set in Vercel dashboard (production scope)
- [ ] Trigger production deploy
- [ ] Visit live URL — landing page loads, `/dashboard` loads, wallet connects
- [ ] Sanity check: click Deploy on live URL with a tiny test amount
- [ ] Copy live URL → paste into Bitget submission form
- [ ] Attach demo video link
- [ ] Submit

---

## Submission payload (one place, copy-paste ready)

| Field          | Value                                            |
|----------------|--------------------------------------------------|
| Project name   | Agent.OS                                         |
| Tagline        | Autonomous Trading Intelligence — on-chain.      |
| Live URL       | _paste Vercel URL here_                          |
| Repo URL       | _paste GitHub URL here_                          |
| Demo video     | _paste video URL here_                           |
| Chains demoed  | Sepolia / Base Sepolia / BNB Testnet / Morph     |
| Vault contract | `contracts/AgentVault.sol` (Solidity 0.8.24)     |

---

**You are done coding. Ship it.**
