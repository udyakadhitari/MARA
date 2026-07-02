import os
from langchain_openai import ChatOpenAI

def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    return ChatOpenAI(
        model="gpt-4o-mini",
        api_key=api_key,
        temperature=0.1,
        timeout=45.0
    )

