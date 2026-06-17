import time
from typing import Dict, Any, Optional

class MemoryCache:
    def __init__(self, default_ttl: int = 60):
        self._cache: Dict[str, dict] = {}
        self._default_ttl = default_ttl  # seconds
        
    def get(self, key: str) -> Optional[Any]:
        entry = self._cache.get(key)
        if entry is None:
            return None
        if time.monotonic() > entry["expires"]:
            self._cache.pop(key, None)
            return None
        return entry["data"]
        
    def set(self, key: str, data: Any, ttl: Optional[int] = None):
        self._cache[key] = {
            "data": data,
            "expires": time.monotonic() + (ttl if ttl is not None else self._default_ttl)
        }
        
    def invalidate(self, prefix: str):
        keys_to_del = [k for k in self._cache.keys() if prefix in k]
        for k in keys_to_del:
            self._cache.pop(k, None)
            
    def clear(self):
        self._cache.clear()

# TTL of 120 seconds — data stays cached for 2 minutes even after mutations
global_cache = MemoryCache(default_ttl=120)
