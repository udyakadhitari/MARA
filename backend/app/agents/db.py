import os
import psycopg2
from psycopg2.extras import RealDictCursor
from openai import OpenAI

def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is not set!")
    return psycopg2.connect(db_url, cursor_factory=RealDictCursor)

def get_embedding(text: str) -> list[float]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set!")
    
    client = OpenAI(api_key=api_key)
    response = client.embeddings.create(
        input=[text],
        model="text-embedding-3-small"
    )
    return response.data[0].embedding
