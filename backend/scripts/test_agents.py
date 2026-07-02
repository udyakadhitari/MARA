import sys
import os
from pprint import pprint
from dotenv import load_dotenv

# Load environmental variables from root .env
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

# Verify key presence
if not os.getenv("OPENAI_API_KEY"):
    print("Error: OPENAI_API_KEY not found. Please verify the .env file.")
    sys.exit(1)
if not os.getenv("TAVILY_API_KEY"):
    print("Error: TAVILY_API_KEY not found. Please verify the .env file.")
    sys.exit(1)

# Ensure the root directory is in the PYTHONPATH so imports resolve correctly
sys.path.insert(0, ROOT_DIR)

from backend.app.agents import research_graph

def main():
    # Reconfigure stdout to use UTF-8 to prevent encoding errors on Windows
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        
    query = "Latest breakthroughs in solid-state batteries"
    print("=" * 60)
    print(f"MARA MULTI-AGENT ORCHESTRATION ISOLATED TEST")
    print(f"Original Query: '{query}'")
    print("=" * 60)

    # Initialize State
    initial_state = {
        "original_query": query,
        "sub_queries": [],
        "search_results": {},
        "scraped_content": {},
        "draft_answer": ""
    }

    # Run the compiled LangGraph step-by-step
    try:
        # stream_mode="updates" yields dicts representing the state changes of each executed node
        for event in research_graph.stream(initial_state, stream_mode="updates"):
            for node_name, state_update in event.items():
                print("\n" + "=" * 50)
                print(f">>> Update from node: '{node_name}'")
                print("=" * 50)
                
                # Print specific details for readability rather than massive raw dicts
                if "sub_queries" in state_update:
                    print("Sub-queries generated:")
                    pprint(state_update["sub_queries"])
                
                if "search_results" in state_update:
                    print("Web search URLs discovered:")
                    pprint(state_update["search_results"])
                    
                if "scraped_content" in state_update:
                    print(f"Scraped pages: (Total {len(state_update['scraped_content'])})")
                    for url, details in state_update["scraped_content"].items():
                        print(f"  - [{details['status'].upper()}] {url}")
                        if details["status"] == "success":
                            print(f"    Title: {details['title']}")
                            print(f"    Excerpt: {details['content'][:150]}...")
                            
                if "draft_answer" in state_update:
                    print("\nFinal Synthesized Answer draft:")
                    print("-" * 50)
                    print(state_update["draft_answer"])
                    print("-" * 50)
                    
    except Exception as e:
        print(f"\nExecution crashed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
