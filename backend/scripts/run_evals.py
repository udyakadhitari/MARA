import asyncio
import os
import sys
import time
import argparse
from typing import List, Dict, Any
from dotenv import load_dotenv

# Ensure backend is in the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

load_dotenv()

from backend.app.agents import research_graph

BENCHMARK_QUERIES = [
    "Latest breakthroughs in solid-state batteries",
    "Impact of microplastics on human lung tissues",
    "Current status of fusion energy Q-factor",
    "Comparison of sodium-ion vs lithium-sulfur batteries",
    "Discoveries in deep sea hydrothermal vent ecosystems",
    "Advancements in CRISPR-based gene therapies for sickle cell",
    "Status of space debris mitigation and active removal",
    "Efficacy of industrial carbon capture technologies",
    "Developments in post-quantum cryptography standards",
    "Recent news about water conservation methods in India"
]

async def evaluate_query(query: str) -> Dict[str, Any]:
    print(f"\nEvaluating Query: '{query}'")
    print("-" * 60)
    
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
        "retry_count": 0,
        "follow_up_questions": []
    }
    
    start_time = time.time()
    try:
        # Run graph
        result = await research_graph.ainvoke(initial_state)
        latency = time.time() - start_time
        
        # 1. Faithfulness (Critic Verdict)
        critic_verdict = result.get("critic_verdict", "fail")
        faithfulness = 100.0 if critic_verdict == "pass" else 0.0
        
        # 2. Source Coverage
        sub_queries = result.get("sub_queries", [])
        search_results = result.get("search_results", {})
        scraped_content = result.get("scraped_content", {})
        
        covered_sub_queries = 0
        searchable_sub_queries = 0
        
        for sq in sub_queries:
            q_text = sq.get("query", "")
            if sq.get("needs_search", True):
                searchable_sub_queries += 1
                urls = search_results.get(q_text, [])
                # Check if any URL for this sub-query was successfully scraped
                has_success_scrape = False
                for url in urls:
                    if scraped_content.get(url, {}).get("status") == "success":
                        has_success_scrape = True
                        break
                if has_success_scrape:
                    covered_sub_queries += 1
        
        source_coverage = (covered_sub_queries / searchable_sub_queries * 100.0) if searchable_sub_queries > 0 else 100.0
        
        print(f"  Critic Verdict  : {critic_verdict.upper()}")
        print(f"  Faithfulness    : {faithfulness}%")
        print(f"  Source Coverage : {source_coverage:.1f}% ({covered_sub_queries}/{searchable_sub_queries} sub-queries answered)")
        print(f"  Latency         : {latency:.2f}s")
        
        return {
            "query": query,
            "verdict": critic_verdict.upper(),
            "faithfulness": f"{faithfulness}%",
            "source_coverage": f"{source_coverage:.1f}%",
            "latency": f"{latency:.1f}s",
            "status": "Success"
        }
    except Exception as e:
        latency = time.time() - start_time
        print(f"  FAILED to execute graph: {e}")
        return {
            "query": query,
            "verdict": "N/A",
            "faithfulness": "N/A",
            "source_coverage": "N/A",
            "latency": f"{latency:.1f}s",
            "status": f"Failed: {str(e)[:50]}"
        }

async def main():
    parser = argparse.ArgumentParser(description="MARA Agentic Evaluation Harness")
    parser.add_argument("--limit", type=int, default=10, help="Number of benchmark queries to run")
    args = parser.parse_args()
    
    queries = BENCHMARK_QUERIES[:args.limit]
    print("=" * 60)
    print("MARA AGENTIC PIPELINE EVALUATION HARNESS")
    print(f"Running evaluation on {len(queries)} queries...")
    print("=" * 60)
    
    results = []
    for idx, q in enumerate(queries):
        print(f"\n[Progress: {idx+1}/{len(queries)}]")
        res = await evaluate_query(q)
        results.append(res)
        
    print("\n" + "=" * 60)
    print("EVALUATION COMPLETED - SUMMARY REPORT")
    print("=" * 60)
    
    # Generate Markdown Table
    markdown_table = (
        "| Query | Status | Faithfulness (Critic) | Source Coverage | Latency |\n"
        "| :--- | :--- | :--- | :--- | :--- |\n"
    )
    for r in results:
        markdown_table += f"| {r['query']} | {r['status']} | {r['faithfulness']} | {r['source_coverage']} | {r['latency']} |\n"
        
    print(markdown_table)
    
    # Save to walkthrough directory
    eval_log_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "eval_results.md"))
    with open(eval_log_path, "w", encoding="utf-8") as f:
        f.write("# MARA Pipeline Evaluation Benchmarks\n\n")
        f.write(f"Generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(markdown_table)
    print(f"Results saved to {eval_log_path}")

if __name__ == "__main__":
    asyncio.run(main())
