# Kyma (Kyma Terminal)

**Autonomous Trading Intelligence — A deterministic, multi-timeframe execution engine for the OKX Track.**

Kyma is not just a chatbot. It is a fully transparent Agent Service Provider (ASP). The central pitch is simple: **Kyma eliminates black-box AI trading by visually auditing its own logic on live charts before executing governed strategies.**

Built for the OKX Hackathon (Finance Copilot / Best Product), Kyma combines a deterministic policy engine with real-time streaming market data.

---

## What this is

Two experiences glued together:

1. **The landing page** — A multi-phase interactive experience introducing the Kyma ASP.
2. **The terminal** (`/dashboard`) — An institutional dark-mode trading cockpit featuring:
   - Live AI Execution Terminal streaming reasoning logs.
   - Live TradingView SMC chart bound to WebSocket ticker streams.
   - Split-plane interface for top 10 crypto markets.
   - Deterministic risk controls (Max Drawdown, Position Size).

Every agent action—deploy, open trade, close trade, pause, terminate—is strictly governed by a hard-coded risk validator that intercepts and rejects LLM recommendations violating user-defined bounds.

---

## Stack

| Layer        | Choice                                                   |
|--------------|----------------------------------------------------------|
| Framework    | Next.js 16 (App Router) + React 19                       |
| Backend      | Python FastAPI + `ccxt` (WebSockets)                     |
| Intelligence | Multi-Timeframe Structural Analyzer + Policy Engine      |
| Charts       | lightweight-charts (TradingView)                         |
| 3D & Motion  | React Three Fiber, Drei, Framer Motion                   |
| Styling      | Tailwind CSS, Bebas Neue + DM Mono                       |

---

## Quick start

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python main.py
```

### 2. Frontend (Next.js)
```bash
npm install
npm run dev
```

Open http://localhost:3000 for the landing page, or jump straight to http://localhost:3000/dashboard.

---

## Architecture Overview

### Dynamic Market Router
The Python FastAPI backend pulls live, streaming asset ticker updates for the top 10 crypto assets (BTC, ETH, SOL, etc.) using `ccxt` Pro (async WebSockets).

### Multi-Timeframe Structural Analyzer
The intelligence layer evaluates market structure across simultaneous intervals. Kyma analyzes 5-minute charts for liquidity sweeps and 4-hour charts for macro trends to autonomously determine setup validity.

### Deterministic Policy Engine
Before Kyma routes any trade or calculates lot sizing, the AI's decision is forced through a hard-coded risk validator. This system layer instantly rejects any LLM recommendation that violates user-defined maximum drawdowns or lot-size caps.

---

## OKX ASP Submission

Kyma is packaged as an Agent Service Provider (ASP) with rigid input and output schemas matching OKX.AI platform specifications, allowing instant internal review team verification.
