from typing import List, Dict, Any, TypedDict, Optional

class SubQuery(TypedDict):
    query: str
    needs_search: bool

class AgentState(TypedDict):
    original_query: str
    sub_queries: List[SubQuery]
    search_results: Dict[str, List[str]]        # sub_query -> list of URLs
    scraped_content: Dict[str, Dict[str, Any]]   # url -> { "title": str, "content": str, "status": str }
    draft_answer: str
    claims: List[Dict[str, Any]]
    confidence: float
    critic_feedback: str
    critic_verdict: str
    retry_count: int
    follow_up_questions: List[str]
    session_id: str
    user_id: str           # Clerk user_id — identifies who made the request
    memory_context: str
    openai_api_key: Optional[str]
