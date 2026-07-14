# Kyma Terminal 

**Autonomous Trading Intelligence — A deterministic, multi-timeframe execution engine designed for the OKX Ecosystem.**

---

## 🛑 The Problem: The "Black Box" of AI Trading
The current landscape of AI-driven trading is plagued by a massive lack of transparency. Users are expected to blindly trust "black box" models that execute trades based on hidden parameters, obscure logic, and unseen data. When a trade goes wrong, there is no trail of accountability, no way to audit the AI’s reasoning, and no hard-coded risk management to protect the user's capital. 

This creates an environment where institutional and retail traders alike are sidelined by the sheer risk of adopting AI financial copilots. 

## 💡 The Solution: Kyma 
Kyma is a fully transparent Agent Service Provider (ASP). We eliminate black-box AI trading by visually auditing our agent's logic on live charts before executing any governed strategies. 

Kyma bridges the gap between autonomous AI capabilities and institutional-grade risk management. It combines a **deterministic policy engine** with real-time streaming market data, ensuring that every AI decision is strictly governed by user-defined constraints.

### Key Innovations:
1. **Glass-Box Transparency:** Watch the AI analyze the market in real-time. The Reasoning Terminal streams the agent's internal thought process—perceiving liquidity sweeps, order block formations, and volatility expansions.
2. **Deterministic Risk Validation:** Before the agent can route a trade or calculate lot sizing, the decision is forced through a rigid Policy Engine. If an LLM's recommendation violates your max drawdown or position size limits, it is instantly rejected.
3. **Multi-Timeframe Structural Analysis:** Kyma evaluates market structure across simultaneous intervals, autonomously analyzing 5-minute charts for liquidity sweeps and 4-hour charts for macro trends to confirm setup validity.
4. **Live Visual Audit:** An integrated TradingView-style Smart Money Concepts (SMC) chart bounds directly to the AI's WebSocket data stream, rendering the agent's identified order blocks and patterns natively on the UI.

---

## 🏗 Architecture Overview

Kyma consists of two heavily synchronized layers:

### 1. The Execution Engine (Backend)
Built on **Python FastAPI** and **CCXT Pro**, the backend serves as the brain of the ASP.
- **Dynamic Market Router:** Pulls live, streaming tick updates for the Top 10 crypto assets (BTC, ETH, SOL, etc.) using async WebSockets.
- **Structural Analyzer:** Continuously scores market setups and momentum.
- **Policy Engine:** The uncompromising risk validator that enforces capital allocation and hard stop-loss limits.
- **ASP Endpoints:** Pre-configured REST endpoints matching standard OKX ASP schema inputs and outputs for seamless deployment.

### 2. The Command Cockpit (Frontend)
Built on **Next.js 16**, **React 19**, and **React Three Fiber**, the frontend provides a breathtaking institutional dark-mode terminal.
- **Split-Plane Interface:** Effortlessly toggle between the top 10 crypto markets.
- **Reasoning Terminal:** A live readout of the AI's processing and decision logs.
- **SMC Chart:** Built with `lightweight-charts`, the graph reflects the live tick data and dynamically draws support/resistance boundaries based on the AI's WebSocket broadcasts.

---

## 🚀 How to Use Kyma

### 1. Start the Backend (FastAPI)
The Python engine needs to be running to stream live market data and evaluate risk.
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
*The backend is now listening on `ws://localhost:8000/ws` for frontend connections.*

### 2. Start the Frontend (Next.js)
Boot up the cinematic Next.js interface.
```bash
# In the root directory
npm install
npm run dev
```

### 3. Deploy the Agent
1. Open [http://localhost:3000](http://localhost:3000) for the immersive 3D landing page experience, or jump straight to the cockpit at [http://localhost:3000/dashboard](http://localhost:3000/dashboard).
2. In the **Config Sidebar**, select your Collateral Asset (ETH or USDC).
3. Select your desired market from the **Top 10 Crypto Market Selector** (e.g., BTC/USDT).
4. Set your **Allocated Capital**, **Risk Per Trade**, and **Max Drawdown**.
5. Click **DEPLOY AGENT**. 
6. Watch as the WebSocket connection engages and the Reasoning Terminal and SMC Chart spring to life, rendering the AI's autonomous trading intelligence in real-time.

---

## 🌍 Deployment Guide (Vercel + Railway)

The repository is fully split to allow seamless deployments of the frontend to Vercel and the backend to Railway.

### Frontend Deployment (Vercel)
1. Push the repository to GitHub and import it into Vercel.
2. In the **Vercel Project Settings > General**, change the **Root Directory** to `frontend`.
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_WS_URL`: Set this to your Railway WebSocket URL (e.g., `wss://kyma-backend.up.railway.app/ws`).
4. Click Deploy. Vercel will automatically build the Next.js app inside the `frontend` folder while entirely ignoring the Python backend.

### Backend Deployment (Railway)
1. In your Railway dashboard, create a new project and select **Deploy from GitHub repo**.
2. Select this repository.
3. Railway will automatically detect the Python environment. Go to **Settings > Service > Root Directory** and change it to `/backend`.
4. The `Procfile` is already included to spin up the FastAPI server and dynamically bind to Railway's `$PORT`.
5. Once deployed, grab the public domain (e.g., `kyma-backend.up.railway.app`) and prefix it with `wss://` to plug into your Vercel environment variables.

---

## 🛠 Technology Stack

| Layer        | Technology                                               |
|--------------|----------------------------------------------------------|
| Frontend     | Next.js 16, React 19, Tailwind CSS                       |
| Backend      | Python, FastAPI, CCXT, Pydantic                          |
| Websockets   | FastAPI WebSockets -> React `useRef` bindings            |
| Charts       | Lightweight-Charts (TradingView)                         |
| 3D / Motion  | React Three Fiber, Drei, Framer Motion                   |

---
*Built for the OKX Hackathon (Finance Copilot / Best Product).*
