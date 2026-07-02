import os
from typing import Dict, Any
from ..state import AgentState

def search_node(state: AgentState) -> Dict[str, Any]:
    print("\n--- [Search Node] Running Web Search per Sub-Query ---")
    sub_queries = state["sub_queries"]
    search_results = {}
    
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    if not tavily_api_key:
        print("Warning: TAVILY_API_KEY environment variable not found. Search results will be empty.")
        return {"search_results": {}}
        
    from tavily import TavilyClient
    from ..cache import search_cache
    tavily_client = TavilyClient(api_key=tavily_api_key)
    
    for sq in sub_queries:
        query_text = sq["query"]
        if sq["needs_search"]:
            # Check cache
            cached_urls = search_cache.get(query_text)
            if cached_urls is not None:
                print(f"[Cache Hit] Using cached search results for sub-query: '{query_text}'")
                search_results[query_text] = cached_urls
                continue

            print(f"Searching for sub-query: '{query_text}'...")
            try:
                response = tavily_client.search(query=query_text, max_results=3)
                urls = [result["url"] for result in response.get("results", [])]
                search_results[query_text] = urls
                search_cache.set(query_text, urls)
                print(f"  Found {len(urls)} URLs: {urls}")
            except Exception as e:
                print(f"  Tavily search failed for '{query_text}': {e}")
                search_results[query_text] = []
        else:
            print(f"Skipping search for direct sub-query: '{query_text}'")
            search_results[query_text] = []
            
    return {"search_results": search_results}
