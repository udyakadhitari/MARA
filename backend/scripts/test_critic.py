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

# Import graph components
from backend.app.agents.state import AgentState
from backend.app.agents.nodes import (
    synthesizer_node, 
    critic_node, 
    fallback_node
)
from backend.app.agents.graph import should_continue

def run_critic_test():
    print("=" * 65)
    print("MARA CRITIC FACT-CHECKING AND RETRY LOOP ISOLATED TEST")
    print("=" * 65)

    # 1. Setup Mock State with deliberate contradiction
    # Query asks for Samsung specifications.
    # Scraped source says: range is ONLY 150 km, charging takes 9 hours.
    # We will simulate a synthesizer that claims a range of 965 km and 9 minutes charge (hallucination/mismatch)
    # and verify that the Critic catches it.
    
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

    # -----------------------------------------------------------------
    # Step 1: Run Synthesizer (Initial Draft)
    # We expect the synthesizer to read the source and generate an answer.
    # But wait, to test if the Critic catches a bad claim, we will first
    # run the synthesizer. Let's see if the synthesizer gets it right, or
    # if it makes a mistake. To guarantee a contradiction for testing the Critic,
    # we can inject a pre-defined incorrect draft and claims, OR we can let the LLM
    # generate a draft and if it's correct, we deliberately inject a bad claim to test the critic!
    # Let's run the synthesizer to see what it generates.
    # -----------------------------------------------------------------
    print("\n--- Running Synthesizer (Initial Draft generation) ---")
    state = synthesizer_node(initial_state)
    
    # Print the draft
    print("\nGenerated Draft Answer:")
    print("-" * 50)
    print(state["draft_answer"])
    print("-" * 50)
    print("Extracted Claims:")
    pprint(state["claims"])

    # For the test of the Critic agent, let's deliberately inject an incorrect claim
    # to guarantee we test the Critic's factual audit and the retry loop.
    print("\n[Test Mode] Injecting a deliberate false claim to test the Critic...")
    state["claims"].append({
        "claim_text": "Samsung's battery has a range of 965 kilometers and charges in 9 minutes.",
        "source_url": "https://example.com/samsung-spec"
    })
    # Also update the draft text to include this false information
    state["draft_answer"] += "\n\nIn addition, Samsung's battery has a range of 965 kilometers and charges in 9 minutes."
    
    print("\nUpdated Draft Answer with Contradictory Claim:")
    print("-" * 50)
    print(state["draft_answer"])
    print("-" * 50)
    print("Claims to be verified by Critic:")
    pprint(state["claims"])

    # -----------------------------------------------------------------
    # Step 2: Run Critic Node
    # -----------------------------------------------------------------
    # Prepare the state for the Critic node
    critic_input_state = {
        **initial_state,
        "draft_answer": state["draft_answer"],
        "claims": state["claims"],
        "retry_count": state["retry_count"]
    }
    
    critic_output = critic_node(critic_input_state)
    
    # Merge critic output
    critic_result_state = {
        **critic_input_state,
        "critic_feedback": critic_output["critic_feedback"],
        "critic_verdict": critic_output["critic_verdict"]
    }

    # -----------------------------------------------------------------
    # Step 3: Run Router decision
    # -----------------------------------------------------------------
    route = should_continue(critic_result_state)
    
    if route == "synthesize":
        # -------------------------------------------------------------
        # Step 4: Run Synthesizer again (Retry 1) with Critic Feedback
        # -------------------------------------------------------------
        print("\n--- Running Synthesizer again (Retry 1) with Critic Feedback ---")
        # Synthesizer increments retry_count because critic_verdict was 'fail'
        retry_state = synthesizer_node(critic_result_state)
        
        print("\nRevised Draft Answer (should correct the range to 150km and 9 hours):")
        print("-" * 50)
        print(retry_state["draft_answer"])
        print("-" * 50)
        print("Revised Claims:")
        pprint(retry_state["claims"])
        
        # -------------------------------------------------------------
        # Step 5: Run Critic again on the corrected draft
        # -------------------------------------------------------------
        critic_input_state_2 = {
            **critic_result_state,
            "draft_answer": retry_state["draft_answer"],
            "claims": retry_state["claims"],
            "retry_count": retry_state["retry_count"],
            "critic_verdict": "fail" # previous verdict
        }
        
        critic_output_2 = critic_node(critic_input_state_2)
        
        critic_result_state_2 = {
            **critic_input_state_2,
            "critic_feedback": critic_output_2["critic_feedback"],
            "critic_verdict": critic_output_2["critic_verdict"]
        }
        
        # Check final route
        final_route = should_continue(critic_result_state_2)
        if final_route == "end":
            print("\nSUCCESS: Critic verified and passed the corrected draft!")
        else:
            print(f"\nFailed: Graph routed to '{final_route}' instead of ending.")
            
    elif route == "fallback":
        print("\nSUCCESS: Max retries exhausted, routed to Fallback as expected.")
        fallback_res = fallback_node(critic_result_state)
        print("\nFallback Output:")
        print(fallback_res["draft_answer"])
    else:
        print(f"\nWarning: Critic passed the bad claim! Route: {route}")

if __name__ == "__main__":
    run_critic_test()
