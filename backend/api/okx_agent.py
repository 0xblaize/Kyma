from fastapi import APIRouter
from schemas.okx_specs import AgentInputSchema, AgentOutputSchema

router = APIRouter()

@router.post("/api/v1/agent/deploy", response_model=AgentOutputSchema)
async def deploy_agent(payload: AgentInputSchema):
    """
    OKX ASP standard deployment endpoint.
    Verifies rigid input schema and approves agent to go live.
    """
    # Here we would update our Policy Engine or DB with the new bounds
    return AgentOutputSchema(
        status="ACTIVE",
        current_drawdown=0.0,
        active_positions=0,
        message=f"Agent successfully deployed on {payload.asset} with max drawdown {payload.max_drawdown}%"
    )

@router.get("/api/v1/agent/status", response_model=AgentOutputSchema)
async def get_agent_status():
    """
    OKX ASP standard status endpoint.
    """
    return AgentOutputSchema(
        status="ACTIVE",
        current_drawdown=0.0,
        active_positions=0,
        message="Agent is running optimally."
    )
