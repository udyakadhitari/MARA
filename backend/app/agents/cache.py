import time
import hashlib
from typing import Any, Dict, Optional

class InMemoryCache:
    def __init__(self, ttl_seconds: int = 3600):
        self.store: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl_seconds

    def _hash_key(self, key: str) -> str:
        return hashlib.sha256(key.strip().lower().encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        h = self._hash_key(key)
        if h in self.store:
            entry = self.store[h]
            if time.time() - entry["timestamp"] < self.ttl:
                return entry["data"]
            else:
                del self.store[h] # expired
        return None

    def set(self, key: str, data: Any):
        h = self._hash_key(key)
        self.store[h] = {
            "timestamp": time.time(),
            "data": data
        }

# Global instances
search_cache = InMemoryCache(ttl_seconds=3600)   # 1 hour cache for sub-query search results
scrape_cache = InMemoryCache(ttl_seconds=86400)  # 24 hour cache for scraped pages content
