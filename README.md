# MARA: Multi-Agent Research Agent 🔬🤖

MARA is a premium, state-of-the-art Multi-Agent Research Assistant and Orchestrator designed to perform deep, multi-aspect research on complex queries.

## 🚀 Key Features

*   **Multi-Agent LangGraph Orchestration**: Leverages a graph-based workflow dividing roles into **Orchestrator** (query decomposition), **Search** (parallel web queries), **Scraper** (content extraction), **Verify** (fact checking and citation extraction), and **Synthesizer** (final report builder).
*   **Real-time Streaming (SSE)**: Streams node status changes, sub-query resolutions, scraped URLs, and token-by-token final answers via Server-Sent Events (SSE).
*   **Persistent Vector Memory**: Implements short-term conversational context (sliding window of last 5 turns) and long-term memory retrieval using pgvector similarity search over Supabase PostgreSQL.
*   **Dynamic Session Summarization**: Automatically runs a background LLM summarization step every 5 turns to update the active session's running summary.
*   **Clerk Authentication**: Secures endpoints and organizes query histories on a per-user basis.
*   **Local Caching**: Minimizes costs and latency by caching scraper pages and search results.
*   **Premium React UI**: Dark-mode optimized dashboard featuring live trace inspection, citation viewers, markdown rendering, and speech-to-text input.

---

## 🛠️ Tech Stack

*   **Backend**: Python, FastAPI, LangGraph, OpenAI GPT-4o-Mini / GPT-3.5, Supabase (PostgreSQL + pgvector).
*   **Frontend**: React (TS), Vite, TailwindCSS, Clerk Auth SDK.

---

## 🔧 Getting Started

### 1. Backend Setup
1. Clone the repository and initialize the virtual environment:
    ```bash
    python -m venv .venv
    .venv\Scripts\activate
    pip install -r requirements.txt
    ```
2. Create a `.env` file in the root with:
    ```env
    OPENAI_API_KEY=your-openai-api-key
    TAVILY_API_KEY=your-tavily-api-key
    GEMINI_API_KEY=your-gemini-api-key
    DATABASE_URL=postgresql://postgres:...@db...supabase.co:5432/postgres
    ```
3. Run the backend:
    ```bash
    python -m uvicorn backend.app.main:app --port 8000 --reload
    ```

### 2. Frontend Setup
1. Install dependencies:
    ```bash
    cd frontend
    npm install
    ```
2. Create `frontend/.env` with your publishable keys:
    ```env
    VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
    VITE_SUPABASE_URL=https://...
    VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
    ```
3. Run the development server:
    ```bash
    npm run dev
    ```
