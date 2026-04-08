"""
Simple in-memory cache for bracket data
"""
from typing import Dict, Any, Optional
import time
import os
from datetime import datetime, timedelta

class BracketCache:
    def __init__(self, ttl_seconds: int = None):
        # Default TTL: 60 minutes in development, 30 minutes in production
        default_ttl = 3600 if os.getenv("ENVIRONMENT") == "development" else 1800
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._ttl = ttl_seconds or default_ttl
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        if key in self._cache:
            entry = self._cache[key]
            if time.time() - entry['timestamp'] < self._ttl:
                return entry['data']
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, data: Dict[str, Any]) -> None:
        self._cache[key] = {
            'data': data,
            'timestamp': time.time()
        }
    
    def invalidate(self, pattern: str = None) -> None:
        if pattern:
            keys_to_remove = [k for k in self._cache.keys() if pattern in k]
            for key in keys_to_remove:
                del self._cache[key]
        else:
            self._cache.clear()

# Global cache instance
bracket_cache = BracketCache()