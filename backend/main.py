from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.websockets import router as websocket_router
from api.okx_agent import router as okx_router
import asyncio
from services.market_router import start_market_router

app = FastAPI(title="Kyma ASP Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For hackathon/development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(websocket_router)
app.include_router(okx_router)

@app.on_event("startup")
async def startup_event():
    # Start the market router as a background task
    asyncio.create_task(start_market_router())

@app.get("/")
def read_root():
    return {"status": "Kyma backend is running"}
