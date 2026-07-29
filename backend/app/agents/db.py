import os
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from openai import OpenAI

import sqlite3
import json

class SQLiteCursorWrapper:
    def __init__(self, cursor):
        self._cursor = cursor
        
    def execute(self, sql, params=()):
        sql_converted = sql.replace("%s", "?").replace("::jsonb", "").replace("::vector", "")
        clean_params = []
        for p in params:
            if isinstance(p, (list, dict)):
                clean_params.append(json.dumps(p))
            else:
                clean_params.append(p)
        return self._cursor.execute(sql_converted, tuple(clean_params))
        
    def fetchone(self):
        row = self._cursor.fetchone()
        return dict(row) if row else None
        
    def fetchall(self):
        rows = self._cursor.fetchall()
        return [dict(r) for r in rows]
        
    def close(self):
        return self._cursor.close()
        
    def __getattr__(self, name):
        return getattr(self._cursor, name)

class SQLiteConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn
        
    def cursor(self):
        return SQLiteCursorWrapper(self._conn.cursor())
        
    def commit(self):
        return self._conn.commit()
        
    def rollback(self):
        return self._conn.rollback()
        
    def close(self):
        return self._conn.close()
        
    def __getattr__(self, name):
        return getattr(self._conn, name)

def _init_sqlite_tables(conn):
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT DEFAULT 'anonymous',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            running_summary TEXT
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            message_id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            turn_index INTEGER,
            role TEXT,
            query_text TEXT,
            answer_text TEXT,
            source_urls TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS message_embeddings (
            message_id INTEGER PRIMARY KEY,
            embedding TEXT
        );
    """)
    conn.commit()

def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        try:
            return psycopg2.connect(db_url, cursor_factory=RealDictCursor, connect_timeout=3)
        except Exception as e:
            print(f"[DB WARN] PostgreSQL unreachable ({e}). Using local SQLite fallback.")
    
    # In Vercel or read-only serverless environment, use /tmp for writable SQLite db
    db_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if os.getenv("VERCEL") or not os.access(db_dir, os.W_OK):
        db_path = "/tmp/mara_memory.db"
    else:
        db_path = os.path.join(db_dir, "mara_memory.db")
        
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    _init_sqlite_tables(conn)
    return SQLiteConnectionWrapper(conn)

def get_embedding(text: str, api_key: Optional[str] = None) -> list[float]:
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY environment variable is not set and no custom API key was provided!")
    
    client = OpenAI(api_key=key)
    response = client.embeddings.create(
        input=[text],
        model="text-embedding-3-small"
    )
    return response.data[0].embedding
