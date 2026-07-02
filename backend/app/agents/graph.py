from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import (
    orchestrator_node,
    search_node,
    scrape_node,
    synthesizer_node,
    critic_node,
    fallback_node,
    memory_retrieval_node,
    memory_write_node
)

def should_continue(state: AgentState) -> str:
    verdict = state.get("critic_verdict", "pass")
    retry_count = state.get("retry_count", 0)
    
    if verdict == "pass":
        print("\n>>> Critic passed the draft. Saving memory and ending research workflow.")
        return "write_memory"
    
    if retry_count < 2:
        print(f"\n>>> Critic failed the draft (Retry {retry_count + 1}/2). Routing back to Synthesizer.")
        return "synthesize"
    
    print("\n>>> Critic failed the draft, and maximum retries (2) have been exhausted. Saving memory and routing to Fallback.")
    return "fallback"

def build_research_graph():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("memory_retrieval", memory_retrieval_node)
    workflow.add_node("orchestrator", orchestrator_node)
    workflow.add_node("search", search_node)
    workflow.add_node("scrape", scrape_node)
    workflow.add_node("synthesize", synthesizer_node)
    workflow.add_node("critic", critic_node)
    workflow.add_node("fallback", fallback_node)
    workflow.add_node("memory_write", memory_write_node)
    
    # Entry point
    workflow.set_entry_point("memory_retrieval")
    
    # Standard edges
    workflow.add_edge("memory_retrieval", "orchestrator")
    workflow.add_edge("orchestrator", "search")
    workflow.add_edge("search", "scrape")
    workflow.add_edge("scrape", "synthesize")
    workflow.add_edge("synthesize", "critic")
    
    # Conditional edge
    workflow.add_conditional_edges(
        "critic",
        should_continue,
        {
            "write_memory": "memory_write",
            "synthesize": "synthesize",
            "fallback": "fallback"
        }
    )
    
    workflow.add_edge("fallback", "memory_write")
    workflow.add_edge("memory_write", END)
    
    return workflow.compile()

research_graph = build_research_graph()
