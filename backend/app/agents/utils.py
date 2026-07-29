import os
from typing import Optional
from langchain_openai import ChatOpenAI

def get_openai_client(api_key: Optional[str] = None):
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY is not set in environment and no custom API key was provided!")
    return ChatOpenAI(
        model="gpt-4o-mini",
        api_key=key,
        temperature=0.1,
        timeout=45.0
    )

