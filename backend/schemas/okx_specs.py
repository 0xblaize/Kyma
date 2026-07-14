from pydantic import BaseModel, Field

class AgentInputSchema(BaseModel):
    asset: str = Field(..., example="BTC/USDT")
    allocated_capital: float = Field(..., example=5000.0)
    risk_per_trade: float = Field(..., example=2.0)
    max_drawdown: float = Field(..., example=10.0)

class AgentOutputSchema(BaseModel):
    status: str = Field(..., example="ACTIVE")
    current_drawdown: float = Field(..., example=0.0)
    active_positions: int = Field(..., example=0)
    message: str = Field(..., example="Agent successfully deployed.")
