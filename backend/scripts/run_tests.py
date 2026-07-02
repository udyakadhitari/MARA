import os
import sys
from pprint import pprint
from dotenv import load_dotenv

# Ensure root directory is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Verify API Keys
def verify_keys():
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY not found in environment variables.")
        sys.exit(1)
    if not os.getenv("TAVILY_API_KEY"):
        print("Error: TAVILY_API_KEY not found in environment variables.")
        sys.exit(1)
    if not os.getenv("GEMINI_API_KEY"):
        print("Error: GEMINI_API_KEY not found in environment variables.")
        sys.exit(1)

# Import graph components
from backend.app.agents import research_graph
from backend.app.agents.state import AgentState
from backend.app.agents.nodes import (
    synthesizer_node, 
    critic_node, 
    fallback_node
)
from backend.app.agents.graph import should_continue

# =====================================================================
# Test Suite 1: Full End-to-End Pipeline (Tavily search + Scrape + Synthesize)
# =====================================================================
def run_pipeline_test():
    verify_keys()
    query = "Latest breakthroughs in solid-state batteries"
    print("\n" + "=" * 70)
    print(f"RUNNING TEST 1: FULL END-TO-END RESEARCH PIPELINE")
    print(f"Original Query: '{query}'")
    print("=" * 70)

    initial_state = {
        "original_query": query,
        "sub_queries": [],
        "search_results": {},
        "scraped_content": {},
        "draft_answer": "",
        "claims": [],
        "confidence": 0.0,
        "critic_feedback": "",
        "critic_verdict": "",
        "retry_count": 0
    }

    try:
        for event in research_graph.stream(initial_state, stream_mode="updates"):
            for node_name, state_update in event.items():
                print("\n" + "-" * 50)
                print(f"Update from node: '{node_name}'")
                print("-" * 50)
                
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
                            
                if "draft_answer" in state_update:
                    print("\nDraft Answer / Report generated:")
                    print(state_update["draft_answer"][:400] + "...\n[Truncated]")
                    if "claims" in state_update:
                        print("Claims:")
                        pprint(state_update["claims"])
                        
                if "critic_verdict" in state_update:
                    print(f"Critic Verdict: {state_update['critic_verdict'].upper()}")
                    print(f"Critic Feedback: {state_update['critic_feedback']}")

        print("\nPipeline test complete.")
    except Exception as e:
        print(f"\nPipeline execution crashed: {e}")
        import traceback
        traceback.print_exc()

# =====================================================================
# Test Suite 2: Critic Fact-Checking and Retry Loop Simulation
# =====================================================================
def run_critic_test():
    verify_keys()
    print("\n" + "=" * 70)
    print("RUNNING TEST 2: CRITIC FACT-CHECKING AND RETRY LOOP SIMULATION")
    print("=" * 70)

    # Setup Mock State with deliberate range mismatch
    mock_scraped_content = {
        "https://example.com/samsung-spec": {
            "title": "Official Samsung Battery Specs",
            "content": (
                "SAMSUNG LABS TESTING REPORT:\n"
                "The prototype solid-state cell has completed its initial cycle runs.\n"
                "The actual measured range of Samsung's prototype solid-state battery is only 150 kilometers on a full charge,\n"
                "and it requires a long 9 hours to reach full capacity due to thermal management limits."
            ),
            "status": "success"
        }
    }

    initial_state: AgentState = {
        "original_query": "What are the specs of Samsung's new solid-state battery?",
        "sub_queries": [{"query": "What are Samsung's solid-state battery specs?", "needs_search": True}],
        "search_results": {"What are Samsung's solid-state battery specs?": ["https://example.com/samsung-spec"]},
        "scraped_content": mock_scraped_content,
        "draft_answer": "",
        "claims": [],
        "confidence": 0.0,
        "critic_feedback": "",
        "critic_verdict": "",
        "retry_count": 0
    }

    # Step 1: Synthesizer generates initial draft
    print("\n--- Step 1: Generating Initial Draft ---")
    state = synthesizer_node(initial_state)
    print(f"Extracted claims from Synthesizer:")
    pprint(state["claims"])

    # Step 2: Inject false claim
    print("\n[Test Mode] Injecting a deliberate false claim to trigger Critic failure...")
    state["claims"].append({
        "claim_text": "Samsung's battery has a range of 965 kilometers and charges in 9 minutes.",
        "source_url": "https://example.com/samsung-spec"
    })
    state["draft_answer"] += "\n\nIn addition, Samsung's battery has a range of 965 kilometers and charges in 9 minutes."
    
    # Step 3: Run Critic Fact Check
    print("\n--- Step 2: Critic Factual Audit ---")
    critic_input = {
        **initial_state,
        "draft_answer": state["draft_answer"],
        "claims": state["claims"],
        "retry_count": state["retry_count"]
    }
    critic_output = critic_node(critic_input)
    
    critic_result = {
        **critic_input,
        "critic_feedback": critic_output["critic_feedback"],
        "critic_verdict": critic_output["critic_verdict"]
    }

    # Step 4: Router
    route = should_continue(critic_result)
    
    if route == "synthesize":
        # Step 5: Synthesizer retry correction
        print("\n--- Step 3: Synthesizer Retry (Should Correct False Claim) ---")
        retry_state = synthesizer_node(critic_result)
        print("\nRevised Draft Report:")
        print("-" * 50)
        print(retry_state["draft_answer"])
        print("-" * 50)
        print("Revised Claims:")
        pprint(retry_state["claims"])
        
        # Step 6: Critic Audit on corrected draft
        print("\n--- Step 4: Critic Final Audit ---")
        critic_input_2 = {
            **critic_result,
            "draft_answer": retry_state["draft_answer"],
            "claims": retry_state["claims"],
            "retry_count": retry_state["retry_count"],
            "critic_verdict": "fail"
        }
        critic_output_2 = critic_node(critic_input_2)
        
        critic_result_2 = {
            **critic_input_2,
            "critic_feedback": critic_output_2["critic_feedback"],
            "critic_verdict": critic_output_2["critic_verdict"]
        }
        
        # Final route check
        final_route = should_continue(critic_result_2)
        if final_route == "end":
            print("\nSUCCESS: Critic fact-checking and retry loop completed correctly!")
        else:
            print(f"\nFailed: Graph routed to '{final_route}' instead of ending.")
    else:
        print(f"\nWarning: Critic routed to '{route}' instead of retrying.")

# =====================================================================
# Main selector CLI
# =====================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("MARA TEST SUITE RUNNER")
    print("=" * 60)
    
    mode = "both"
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()
        
    if mode == "pipeline":
        run_pipeline_test()
    elif mode == "critic":
        run_critic_test()
    elif mode == "both":
        run_pipeline_test()
        run_critic_test()
    else:
        print("Invalid selection. Options: 'pipeline', 'critic', or 'both'")
