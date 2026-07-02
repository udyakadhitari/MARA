import asyncio
import os
import sys
import uuid
from dotenv import load_dotenv

# Ensure backend is in the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
load_dotenv()

from backend.app.agents.db import get_db_connection
from backend.app.agents.nodes.memory import memory_write_node, memory_retrieval_node

async def run_test():
    print("============================================================")
    print("MARA DATABASE & MEMORY PIPELINE TEST")
    print("============================================================")
    
    # 1. Test Connection
    try:
        conn = get_db_connection()
        print("[OK] Database connection successful!")
        conn.close()
    except Exception as e:
        print(f"[ERROR] Database connection failed: {e}")
        return
        
    session_id = str(uuid.uuid4())
    print(f"Generated test session ID: {session_id}")
    
    # 2. Write turn 1
    state_turn_1 = {
        "session_id": session_id,
        "original_query": "What is the capital of France?",
        "draft_answer": "The capital of France is Paris. It is famous for landmarks like the Eiffel Tower.",
        "claims": [{"claim_text": "The capital of France is Paris", "source_url": "https://france.com"}],
        "critic_verdict": "pass"
    }
    
    print("\n--- Writing Turn 1 (Paris) ---")
    memory_write_node(state_turn_1)
    
    # 3. Write turn 2
    state_turn_2 = {
        "session_id": session_id,
        "original_query": "What is the capital of Germany?",
        "draft_answer": "The capital of Germany is Berlin. It is known for its history and culture.",
        "claims": [{"claim_text": "The capital of Germany is Berlin", "source_url": "https://germany.com"}],
        "critic_verdict": "pass"
    }
    
    print("\n--- Writing Turn 2 (Berlin) ---")
    memory_write_node(state_turn_2)
    
    # 4. Test Retrieval
    state_retrieval = {
        "session_id": session_id,
        "original_query": "What capital did we talk about earlier?",
        "sub_queries": []
    }
    
    print("\n--- Retrieving memory context for RAG match ---")
    result = memory_retrieval_node(state_retrieval)
    context = result.get("memory_context", "")
    print("-" * 40)
    print(context)
    print("-" * 40)
    
    if "Paris" in context or "Berlin" in context:
        print("\n[OK] SUCCESS: Correct prior conversation context retrieved!")
    else:
        print("\n[ERROR] FAILURE: Memory context did not contain 'Paris' or 'Berlin'")

if __name__ == "__main__":
    asyncio.run(run_test())
