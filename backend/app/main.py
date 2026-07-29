import os
import sys
import uuid
import json
import datetime
import asyncio
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Ensure root is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

load_dotenv(os.path.join(ROOT_DIR, ".env"))

from backend.app.agents import research_graph
from backend.app.auth import get_current_user, get_current_user_optional

import time
from fastapi import Request
from fastapi.responses import JSONResponse

app = FastAPI(title="MARA Backend Server", version="1.0.0")

# 1. CORS origin locking (CORS Hardening)
frontend_url = os.getenv("FRONTEND_URL")
allowed_origins = [frontend_url] if frontend_url else ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. In-memory Rate Limiting configuration
RATE_LIMIT_STORE = {}
RATE_LIMIT_WINDOW = 60 # seconds
RATE_LIMIT_MAX_REQUESTS = 30 # requests per minute

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        
        # Keep only timestamps within the window
        timestamps = RATE_LIMIT_STORE.get(client_ip, [])
        timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
        
        if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
            print(f"Rate Limiter: Blocked IP {client_ip} (Exceeded {RATE_LIMIT_MAX_REQUESTS} req/min)")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please wait before retrying."}
            )
            
        timestamps.append(now)
        RATE_LIMIT_STORE[client_ip] = timestamps
        
    return await call_next(request)

# In-memory dictionary to store queries temporarily
# In-memory dictionary to store queries temporarily
ACTIVE_TASKS: Dict[str, Dict[str, str]] = {}

# Global settings state (in-memory)
SYSTEM_SETTINGS = {
    "default_model": "gpt-4o-mini",
    "temperature": 0.2,
    "search_depth": "DEEP",
    "max_search_results": 10
}

# =====================================================================
# Logger Helper
# =====================================================================
def log_query(task_id: str, query: str, status: str):
    log_file = os.path.join(ROOT_DIR, "backend", "query_logs.jsonl")
    # Ensure backend dir exists
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    now = datetime.datetime.now()
    log_entry = {
        "task_id": task_id,
        "query": query,
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "timestamp": now.isoformat(),
        "status": status,
        "model": SYSTEM_SETTINGS["default_model"]
    }
    
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        print(f"Logging failed: {e}")

# =====================================================================
# API Models
# =====================================================================
class ResearchRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None  # Clerk user_id passed from frontend
    openai_api_key: Optional[str] = None

class SettingsUpdate(BaseModel):
    default_model: str
    temperature: float
    search_depth: str

class VerifyKeyRequest(BaseModel):
    openai_api_key: str

class FollowUpsRequest(BaseModel):
    query: str
    answer: str
    openai_api_key: Optional[str] = None

class SessionUpdate(BaseModel):
    running_summary: str

# =====================================================================
# API Endpoints
# =====================================================================

@app.post("/api/research/run")
async def run_research(
    request: ResearchRequest,
    auth_user_id: Optional[str] = Depends(get_current_user_optional)
):
    query_text = request.query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # Prefer verified JWT user_id, fall back to body-supplied one (for SSE sessions)
    user_id = auth_user_id or request.user_id or "anonymous"
        
    session_id = request.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
        
    task_id = f"res_{uuid.uuid4().hex[:12]}"
    ACTIVE_TASKS[task_id] = {
        "query": query_text,
        "session_id": session_id,
        "user_id": user_id,
        "openai_api_key": request.openai_api_key
    }
    
    # Log task registration
    log_query(task_id, query_text, "PENDING")
    
    return {
        "task_id": task_id,
        "query": query_text,
        "session_id": session_id,
        "user_id": user_id,
        "status": "PENDING"
    }


@app.get("/api/research/stream/{task_id}")
async def stream_research(task_id: str):
    task_info = ACTIVE_TASKS.get(task_id)
    if not task_info:
        raise HTTPException(status_code=404, detail="Task ID not found or expired.")
        
    query = task_info["query"]
    session_id = task_info["session_id"]
    user_id = task_info.get("user_id", "anonymous")
    openai_api_key = task_info.get("openai_api_key")
    
    async def sse_generator():
        print(f"SSE: Starting stream for task {task_id} with query: '{query}'")
        
        # Initial status
        yield f"event: status\ndata: {json.dumps({'status': 'RUNNING', 'active_step': 'orchestrator'})}\n\n"
        
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
            "follow_up_questions": [],
            "session_id": session_id,
            "user_id": user_id,
            "memory_context": "",
            "openai_api_key": openai_api_key
        }
        
        run_trace = {
            "task_id": task_id,
            "query": query,
            "timestamp": datetime.datetime.now().isoformat(),
            "steps": []
        }
        
        try:
            # Run LangGraph streaming in async mode
            async for event in research_graph.astream(initial_state, stream_mode="updates"):
                for node_name, state_update in event.items():
                    print(f"SSE: Node '{node_name}' finished execution.")
                    
                    # Log step to trace
                    run_trace["steps"].append({
                        "node": node_name,
                        "timestamp": datetime.datetime.now().isoformat(),
                        # JSON-serialize helper to avoid model object serialization errors
                        "state_update": json.loads(json.dumps(state_update, default=str))
                    })
                    
                    if node_name == "orchestrator":
                        sub_queries = state_update.get("sub_queries", [])
                        yield f"event: orchestrator-done\ndata: {json.dumps({'sub_queries': sub_queries})}\n\n"
                        
                    elif node_name == "search":
                        search_results = state_update.get("search_results", {})
                        all_urls = []
                        for urls in search_results.values():
                            all_urls.extend(urls)
                        yield f"event: search-done\ndata: {json.dumps({'urls': all_urls})}\n\n"
                        
                    elif node_name == "scrape":
                        scraped = state_update.get("scraped_content", {})
                        scrape_results = {
                            url: {"status": details["status"], "title": details["title"]}
                            for url, details in scraped.items()
                        }
                        yield f"event: scrape-done\ndata: {json.dumps({'results': scrape_results})}\n\n"
                        
                    elif node_name == "critic":
                        verdict = state_update.get("critic_verdict", "pass")
                        feedback = state_update.get("critic_feedback", "")
                        yield f"event: critic-verdict\ndata: {json.dumps({'verdict': verdict, 'feedback': feedback})}\n\n"
                        
                    elif node_name == "synthesize":
                        draft_answer = state_update.get("draft_answer", "")
                        claims = state_update.get("claims", [])
                        confidence = state_update.get("confidence", 0.0)
                        
                        # Yield token stream chunks in blocks
                        words = draft_answer.split(" ")
                        chunk_size = 5
                        for i in range(0, len(words), chunk_size):
                            chunk = " ".join(words[i:i+chunk_size]) + " "
                            yield f"event: synthesizer-token-stream\ndata: {json.dumps({'chunk': chunk, 'done': False})}\n\n"
                            await asyncio.sleep(0.05)
                            
                        # Final finalize chunk with claims and follow-up questions metadata
                        follow_ups = state_update.get("follow_up_questions", [])
                        yield f"event: synthesizer-token-stream\ndata: {json.dumps({'done': True, 'claims': claims, 'confidence': confidence, 'follow_ups': follow_ups})}\n\n"
                        
                    elif node_name == "fallback":
                        # Fallback node just updates the state, synthesizer node will stream it.
                        pass


            # Write final trace file for observability
            trace_dir = os.path.join(ROOT_DIR, "backend", "traces")
            os.makedirs(trace_dir, exist_ok=True)
            with open(os.path.join(trace_dir, f"{task_id}.json"), "w", encoding="utf-8") as f:
                f.write(json.dumps(run_trace, indent=2))

            # Log final success status
            log_query(task_id, query, "COMPLETED")
            yield f"event: complete\ndata: {json.dumps({'task_id': task_id, 'status': 'COMPLETED'})}\n\n"
            
        except Exception as e:
            print(f"SSE: Error running graph for task {task_id}: {e}")
            log_query(task_id, query, "FAILED")
            
            # Write failed trace
            run_trace["error"] = str(e)
            trace_dir = os.path.join(ROOT_DIR, "backend", "traces")
            os.makedirs(trace_dir, exist_ok=True)
            with open(os.path.join(trace_dir, f"{task_id}.json"), "w", encoding="utf-8") as f:
                f.write(json.dumps(run_trace, indent=2))
                
            yield f"event: error\ndata: {json.dumps({'message': f'Execution failed: {str(e)}'})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@app.get("/api/research/history")
async def get_history():
    log_file = os.path.join(ROOT_DIR, "backend", "query_logs.jsonl")
    if not os.path.exists(log_file):
        return []
        
    history_items = []
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    item = json.loads(line.strip())
                    history_items.append({
                        "task_id": item.get("task_id"),
                        "query": item.get("query"),
                        "date": item.get("date", ""),
                        "time": item.get("time", ""),
                        "status": item.get("status")
                    })
    except Exception as e:
        print(f"Error reading history: {e}")
        
    # Return reversed order (newest first), filtering unique query strings
    seen_queries = set()
    unique_history = []
    for item in reversed(history_items):
        q = item["query"].strip().lower()
        if q not in seen_queries:
            seen_queries.add(q)
            unique_history.append(item)
            
    return unique_history


@app.get("/api/settings")
async def get_settings():
    return SYSTEM_SETTINGS


@app.post("/api/settings")
async def update_settings(update: SettingsUpdate):
    SYSTEM_SETTINGS["default_model"] = update.default_model
    SYSTEM_SETTINGS["temperature"] = update.temperature
    SYSTEM_SETTINGS["search_depth"] = update.search_depth
    return {
        "status": "SETTINGS_UPDATED",
        "settings": SYSTEM_SETTINGS
    }

@app.post("/api/settings/verify-key")
async def verify_openai_key(req: VerifyKeyRequest):
    try:
        from langchain_openai import ChatOpenAI
        client = ChatOpenAI(model="gpt-4o-mini", api_key=req.openai_api_key, max_tokens=5, timeout=10.0)
        res = client.invoke("Hi")
        return {"valid": True, "message": "OpenAI API key verified successfully!"}
    except Exception as e:
        return {"valid": False, "message": f"Invalid API key: {str(e)}"}

@app.get("/api/research/trace/{task_id}")
async def get_run_trace(task_id: str):
    trace_file = os.path.join(ROOT_DIR, "backend", "traces", f"{task_id}.json")
    if not os.path.exists(trace_file):
        raise HTTPException(status_code=404, detail="Trace for task ID not found.")
    try:
        with open(trace_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load trace: {str(e)}")

@app.get("/api/sessions")
async def get_sessions(user_id: str = Depends(get_current_user)):
    try:
        from backend.app.agents.db import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "select s.session_id, s.created_at, s.running_summary, "
                "(select m.query_text from messages m where m.session_id = s.session_id order by m.turn_index asc limit 1) as first_query "
                "from sessions s where s.user_id = %s or s.user_id = 'anonymous' order by s.created_at desc",
                (user_id,)
            )
        except Exception:
            conn.rollback()
            cur.execute(
                "select s.session_id, s.running_summary, "
                "(select m.query_text from messages m where m.session_id = s.session_id order by m.turn_index asc limit 1) as first_query "
                "from sessions s where s.user_id = %s or s.user_id = 'anonymous'",
                (user_id,)
            )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        sessions_output = []
        for r in rows:
            summary = r["running_summary"]
            if not summary:
                first_query = r["first_query"]
                if first_query:
                    words = first_query.strip().split()
                    if len(words) > 6:
                        summary = " ".join(words[:6]) + "..."
                    else:
                        summary = " ".join(words)
                else:
                    summary = f"Research ({str(r['session_id'])[:8]})"
            
            created_val = r.get("created_at")
            if created_val and hasattr(created_val, "isoformat"):
                created_str = created_val.isoformat()
            elif created_val:
                created_str = str(created_val)
            else:
                created_str = datetime.datetime.now().isoformat()

            sessions_output.append({
                "session_id": str(r["session_id"]),
                "created_at": created_str,
                "running_summary": summary
            })
            
        return sessions_output
    except Exception as e:
        print(f"Error fetching sessions: {e}")
        return []

def _safe_parse_sources(val):
    if not val:
        return []
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return []
    return []

@app.get("/api/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    user_id: str = Depends(get_current_user)
):
    try:
        from backend.app.agents.db import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        # Verify the session belongs to this user or anonymous
        cur.execute(
            "select user_id from sessions where session_id = %s",
            (session_id,)
        )
        owner_row = cur.fetchone()
        if not owner_row:
            cur.close()
            conn.close()
            return []
        owner = owner_row.get("user_id")
        if owner != "anonymous" and owner != user_id:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail="Session does not belong to this user")

        cur.execute(
            "select query_text, answer_text, source_urls from messages "
            "where session_id = %s "
            "order by turn_index asc",
            (session_id,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [
            {
                "query": r.get("query_text", ""),
                "answer": r.get("answer_text", ""),
                "sources": _safe_parse_sources(r.get("source_urls")),
                "created_at": ""
            }
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"[500 ERROR get_session_messages] {e}")
        return []

@app.delete("/api/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user_id: Optional[str] = Depends(get_current_user_optional)
):
    try:
        from backend.app.agents.db import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        if user_id and user_id != "anonymous":
            # Verify ownership
            cur.execute(
                "select 1 from sessions where session_id = %s and user_id = %s",
                (session_id, user_id)
            )
            if not cur.fetchone():
                cur.close()
                conn.close()
                raise HTTPException(status_code=403, detail="Session does not belong to this user")
        
        # Delete messages and then the session
        cur.execute("delete from messages where session_id = %s", (session_id,))
        cur.execute("delete from sessions where session_id = %s", (session_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "SUCCESS", "message": "Session deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

@app.put("/api/sessions/{session_id}")
async def update_session(
    session_id: str,
    update: SessionUpdate,
    user_id: Optional[str] = Depends(get_current_user_optional)
):
    try:
        from backend.app.agents.db import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        if user_id and user_id != "anonymous":
            # Verify ownership
            cur.execute(
                "select 1 from sessions where session_id = %s and user_id = %s",
                (session_id, user_id)
            )
            if not cur.fetchone():
                cur.close()
                conn.close()
                raise HTTPException(status_code=403, detail="Session does not belong to this user")
        
        cur.execute(
            "update sessions set running_summary = %s where session_id = %s",
            (update.running_summary, session_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "SUCCESS", "message": "Session renamed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename session: {str(e)}")

@app.post("/api/research/follow-ups")
async def generate_follow_ups(req: FollowUpsRequest):
    try:
        from langchain_core.messages import SystemMessage, HumanMessage
        from backend.app.agents.utils import get_openai_client
        llm = get_openai_client(req.openai_api_key)
        
        system_prompt = (
            "You are a helpful research assistant. Based on the following research query and synthesized report, "
            "generate exactly 3 interesting, relevant follow-up questions that a reader might ask for deeper research.\n\n"
            "You MUST return the response as a valid JSON list of strings (e.g. [\"question 1\", \"question 2\", \"question 3\"]). "
            "Do not output markdown code blocks or any conversational intro/outro text, just the raw JSON."
        )
        user_prompt = f"Original Query: {req.query}\n\nReport:\n{req.answer}"
        
        res = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ])
        
        content = res.content.strip()
        # Clean potential markdown wrapping
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        questions = json.loads(content)
        return {"follow_ups": questions}
    except Exception as e:
        print(f"Error generating follow-ups: {e}")
        return {"follow_ups": [
            f"Can you explain more about the technical details related to {req.query[:30]}?",
            "What are the major industry benchmarks or competitors in this space?",
            "What are the key limitations or future research aspects identified?"
        ]}

