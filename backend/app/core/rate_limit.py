import threading
import time
from dataclasses import dataclass

try:
    import redis
except Exception:  # pragma: no cover - import guard for optional runtime
    redis = None


@dataclass
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


class RateLimiter:
    def __init__(
        self,
        redis_url: str | None = None,
        key_prefix: str = "bracketworks:ratelimit",
        require_redis: bool = False,
    ) -> None:
        self.key_prefix = key_prefix
        self._lock = threading.Lock()
        self._memory_store: dict[str, tuple[int, float]] = {}
        self._redis_client = None
        self._require_redis = require_redis

        if redis_url and redis is not None:
            try:
                self._redis_client = redis.from_url(redis_url, decode_responses=True)
                self._redis_client.ping()
            except Exception:
                self._redis_client = None

    def hit(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        if limit <= 0 or window_seconds <= 0:
            return RateLimitResult(allowed=True, limit=limit, remaining=limit, retry_after_seconds=0)

        if self._redis_client:
            result = self._hit_redis(key, limit, window_seconds)
            if result is not None:
                return result

        if self._require_redis:
            return RateLimitResult(
                allowed=False,
                limit=limit,
                remaining=0,
                retry_after_seconds=60,
            )

        return self._hit_memory(key, limit, window_seconds)

    def _hit_redis(self, key: str, limit: int, window_seconds: int) -> RateLimitResult | None:
        now = int(time.time())
        bucket = now // window_seconds
        window_key = f"{self.key_prefix}:{key}:{bucket}"
        window_ends = (bucket + 1) * window_seconds

        try:
            pipe = self._redis_client.pipeline()
            pipe.incr(window_key, 1)
            pipe.expire(window_key, window_seconds + 2)
            count, _ = pipe.execute()
            count = int(count)
            remaining = max(0, limit - count)
            retry_after = max(0, window_ends - now)
            return RateLimitResult(
                allowed=count <= limit,
                limit=limit,
                remaining=remaining,
                retry_after_seconds=retry_after,
            )
        except Exception:
            return None

    def _hit_memory(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        now = time.time()
        with self._lock:
            count, reset_at = self._memory_store.get(key, (0, now + window_seconds))
            if now >= reset_at:
                count = 0
                reset_at = now + window_seconds

            count += 1
            self._memory_store[key] = (count, reset_at)

            # Opportunistic cleanup of stale keys to keep memory bounded.
            if len(self._memory_store) > 10000:
                stale_keys = [k for k, (_, expires_at) in self._memory_store.items() if expires_at < now]
                for stale_key in stale_keys:
                    self._memory_store.pop(stale_key, None)

        remaining = max(0, limit - count)
        retry_after = max(0, int(reset_at - now))
        return RateLimitResult(
            allowed=count <= limit,
            limit=limit,
            remaining=remaining,
            retry_after_seconds=retry_after,
        )
