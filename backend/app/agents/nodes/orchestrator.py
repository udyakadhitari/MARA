from typing import Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from ..state import AgentState
from ..models import DecomposedQueries
from ..utils import get_openai_client

def orchestrator_node(state: AgentState) -> Dict[str, Any]:
    print("\n--- [Orchestrator Node] Decomposing Query ---")
    original_query = state["original_query"]
    
    llm = get_openai_client(state.get("openai_api_key"))
    structured_llm = llm.with_structured_output(DecomposedQueries)
    
    memory_context = state.get("memory_context")
    system_prompt = (
        "You are an expert research coordinator. Your job is to decompose a complex, "
        "raw research query into 2 to 4 distinct, focused sub-queries. "
        "For each sub-query, determine if it requires searching the web (needs_search = True) "
        "or if it can be answered directly using general knowledge or synthesis (needs_search = False)."
    )
    if memory_context:
        system_prompt += f"\n\nHere is the history and context of this research conversation to help you guide your planning:\n{memory_context}"
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", "Decompose the following research query: {query}")
    ])
    
    chain = prompt | structured_llm
    result: DecomposedQueries = chain.invoke({"query": original_query})
    
    sub_queries = [
        {"query": sq.query, "needs_search": sq.needs_search} 
        for sq in result.sub_queries
    ]
    # Hard limit of 4 sub-queries to prevent resource/search abuse
    sub_queries = sub_queries[:4]
    
    print("Decomposed sub-queries:")
    for idx, sq in enumerate(sub_queries):
        print(f"  {idx + 1}. [{ 'SEARCH' if sq['needs_search'] else 'DIRECT' }] {sq['query']}")
        
    return {
        "sub_queries": sub_queries,
        "retry_count": 0,
        "critic_feedback": "",
        "critic_verdict": ""
    }
