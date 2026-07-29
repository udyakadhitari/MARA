import os
import json
import datetime
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage

from ..state import AgentState
from ..db import get_db_connection, get_embedding
from ..utils import get_openai_client

def memory_retrieval_node(state: AgentState) -> Dict[str, Any]:
    print("\n--- [Memory Retrieval Node] Loading Chat History ---")
    session_id = state.get("session_id")
    original_query = state.get("original_query", "").strip()
    
    if not session_id or not original_query:
        print("  No session_id or original_query provided. Skipping memory retrieval.")
        return {"memory_context": ""}
        
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Fetch Session Running Summary
        cur.execute("select running_summary from sessions where session_id = %s", (session_id,))
        summary_row = cur.fetchone()
        running_summary = summary_row["running_summary"] if summary_row else None
        
        # 2. Short-term Memory (Sliding window of last 5 turns)
        cur.execute(
            "select message_id, query_text, answer_text from messages "
            "where session_id = %s "
            "order by turn_index desc "
            "limit 5",
            (session_id,)
        )
        sliding_rows = cur.fetchall()
        
        sliding_window_ids = [row["message_id"] for row in sliding_rows]
        
        short_term_list = []
        for row in reversed(sliding_rows):
            short_term_list.append(f"User: {row['query_text']}\nAgent: {row['answer_text']}")
        short_term_context = "\n\n".join(short_term_list)
        
        # 3. Long-term RAG memory (using pgvector similarity matching)
        rag_context = ""
        try:
            query_embedding = get_embedding(original_query, api_key=state.get("openai_api_key"))
            
            if sliding_window_ids:
                # Exclude turns already covered in the sliding window
                placeholders = ",".join(["%s"] * len(sliding_window_ids))
                rag_query = f"""
                    select m.query_text, m.answer_text, (e.embedding <=> %s::vector) as distance
                    from message_embeddings e
                    join messages m on e.message_id = m.message_id
                    where m.session_id = %s
                      and m.message_id not in ({placeholders})
                    order by distance asc
                    limit 3
                """
                params = [query_embedding, session_id] + sliding_window_ids
            else:
                rag_query = """
                    select m.query_text, m.answer_text, (e.embedding <=> %s::vector) as distance
                    from message_embeddings e
                    join messages m on e.message_id = m.message_id
                    where m.session_id = %s
                    order by distance asc
                    limit 3
                """
                params = [query_embedding, session_id]
                
            cur.execute(rag_query, params)
            rag_rows = cur.fetchall()
            
            rag_list = []
            for row in rag_rows:
                # Only include highly relevant turns (cosine distance < 0.6 is standard)
                if row.get("distance", 1.0) < 0.6:
                    rag_list.append(f"- User asked: {row['query_text']}\n  Agent answered: {row['answer_text']}")
            rag_context = "\n".join(rag_list)
        except Exception as e:
            print(f"  RAG vector retrieval warning: {e}")
            
        cur.close()
        conn.close()
        
        # Assemble memory context blocks
        blocks = []
        if running_summary:
            blocks.append(f"### Running Summary of Session:\n{running_summary}")
        if rag_context:
            blocks.append(f"### Relevant Earlier Turn Matches (Long-Term Memory):\n{rag_context}")
        if short_term_context:
            blocks.append(f"### Recent Conversation Context (Short-Term Memory):\n{short_term_context}")
            
        memory_context = "\n\n".join(blocks)
        
        if memory_context:
            print(f"  Memory Context Loaded ({len(memory_context)} chars).")
        else:
            print("  No prior conversation memory found for this session.")
            
        return {"memory_context": memory_context}
        
    except Exception as e:
        print(f"  Memory retrieval failed gracefully: {e}")
        return {"memory_context": ""}

def memory_write_node(state: AgentState) -> Dict[str, Any]:
    print("\n--- [Memory Write Node] Storing Chat Turn ---")
    session_id = state.get("session_id")
    user_id = state.get("user_id", "anonymous")
    original_query = state.get("original_query", "").strip()
    draft_answer = state.get("draft_answer", "").strip()
    claims = state.get("claims", [])
    
    if not session_id or not original_query or not draft_answer:
        print("  Missing required fields to save memory. Skipping.")
        return {}
        
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Ensure Session exists — store user_id on creation
        cur.execute(
            "insert into sessions (session_id, user_id) values (%s, %s) "
            "on conflict (session_id) do update set user_id = excluded.user_id",
            (session_id, user_id)
        )

        
        # 2. Get Next Turn Index
        cur.execute(
            "select coalesce(max(turn_index), -1) + 1 as next_idx "
            "from messages where session_id = %s",
            (session_id,)
        )
        turn_index = cur.fetchone()["next_idx"]
        
        # 3. Extract Citations list
        source_urls = list(set([c.get("source_url") for c in claims if c.get("source_url")]))
        
        # 4. Insert message turn
        cur.execute(
            "insert into messages (session_id, turn_index, role, query_text, answer_text, source_urls) "
            "values (%s, %s, 'agent', %s, %s, %s::jsonb) "
            "returning message_id",
            (session_id, turn_index, original_query, draft_answer, json.dumps(source_urls))
        )
        message_id = cur.fetchone()["message_id"]
        conn.commit()
        
        # 5. Embed Turn (Query + Answer combined) & Save
        try:
            combined_text = f"Query: {original_query}\nAnswer: {draft_answer}"
            embedding = get_embedding(combined_text, api_key=state.get("openai_api_key"))
            
            cur.execute(
                "insert into message_embeddings (message_id, embedding) "
                "values (%s, %s)",
                (message_id, embedding)
            )
            conn.commit()
            print(f"  Successfully saved turn {turn_index} and generated embeddings.")
        except Exception as e:
            conn.rollback()
            print(f"  Failed to save vector embedding: {e}")
            
        # 6. Periodic Conversation Summary (Every 5 turns)
        if turn_index > 0 and (turn_index + 1) % 5 == 0:
            print(f"  Triggering periodic session summary at turn {turn_index + 1}...")
            try:
                cur.execute(
                    "select query_text, answer_text from messages "
                    "where session_id = %s "
                    "order by turn_index asc",
                    (session_id,)
                )
                history_rows = cur.fetchall()
                
                formatted_history = ""
                for idx, row in enumerate(history_rows):
                    formatted_history += f"Turn {idx+1}:\nUser: {row['query_text']}\nAgent: {row['answer_text']}\n\n"
                    
                llm = get_openai_client(state.get("openai_api_key"))
                prompt = (
                    "You are a conversation logging assistant. Please update the summary "
                    "of this research session. Synthesize the key topics explored, findings, "
                    "and unanswered questions discussed so far in a concise paragraph of 2-3 sentences.\n\n"
                    f"Conversation History:\n{formatted_history}"
                )
                
                summary_res = llm.invoke([
                    SystemMessage(content="You summarize ongoing technical conversations."),
                    HumanMessage(content=prompt)
                ])
                summary_text = summary_res.content.strip()
                
                cur.execute(
                    "update sessions set running_summary = %s where session_id = %s",
                    (summary_text, session_id)
                )
                print("  Successfully updated sessions.running_summary.")
            except Exception as e:
                print(f"  Failed to update running summary: {e}")
                
        conn.commit()
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"  Failed to write turn memory: {e}")
        
    return {}
