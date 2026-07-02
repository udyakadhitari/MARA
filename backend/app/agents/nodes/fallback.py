from typing import Dict, Any
from ..state import AgentState

def fallback_node(state: AgentState) -> Dict[str, Any]:
    print("\n--- [Fallback Node] Failed to Verify Claims ---")
    draft_answer = state["draft_answer"]
    feedback = state.get("critic_feedback", "")
    
    warning = (
        "### WARNING: UNVERIFIED RESEARCH DRAFT\n"
        "**The following research draft could not be fully verified against the source materials after multiple verification retries.**\n"
        f"**Critic verification issues identified:**\n"
        f"> {feedback}\n\n"
        "---\n\n"
    )
    
    return {"draft_answer": warning + draft_answer}
