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

class SettingsUpdate(BaseModel):
    default_model: str
    temperature: float
    search_depth: str

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
        "user_id": user_id
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
            "memory_context": ""
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
                        draft_answer = state_update.get("draft_answer", "")
                        words = draft_answer.split(" ")
                        chunk_size = 5
                        for i in range(0, len(words), chunk_size):
                            chunk = " ".join(words[i:i+chunk_size]) + " "
                            yield f"event: synthesizer-token-stream\ndata: {json.dumps({'chunk': chunk, 'done': False})}\n\n"
                            await asyncio.sleep(0.05)
                        yield f"event: synthesizer-token-stream\ndata: {json.dumps({'done': True, 'claims': [], 'confidence': 0.0})}\n\n"

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
async def get_sessions(user_id: Optional[str] = Depends(get_current_user_optional)):
    try:
        from backend.app.agents.db import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        if user_id and user_id != "anonymous":
            cur.execute(
                "select session_id, created_at, running_summary from sessions "
                "where user_id = %s order by created_at desc",
                (user_id,)
            )
        else:
            # Fallback: return nothing for unauthenticated calls
            return []
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [
            {
                "session_id": str(r["session_id"]),
                "created_at": r["created_at"].isoformat(),
                "running_summary": r["running_summary"]
            }
            for r in rows
        ]
    except Exception as e:
        print(f"Error fetching sessions: {e}")
        return []

@app.get("/api/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    user_id: Optional[str] = Depends(get_current_user_optional)
):
    try:
        from backend.app.agents.db import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        # Verify the session belongs to this user
        if user_id and user_id != "anonymous":
            cur.execute(
                "select 1 from sessions where session_id = %s and user_id = %s",
                (session_id, user_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=403, detail="Session does not belong to this user")
        cur.execute(
            "select query_text, answer_text, source_urls, created_at from messages "
            "where session_id = %s "
            "order by turn_index asc",
            (session_id,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [
            {
                "query": r["query_text"],
                "answer": r["answer_text"],
                "sources": r["source_urls"] if r["source_urls"] else [],
                "created_at": r["created_at"].isoformat()
            }
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch session messages: {str(e)}")
