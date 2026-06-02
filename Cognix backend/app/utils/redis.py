import json
from typing import Optional, Any
import redis.asyncio as redis
from app.config import settings


class RedisClient:
    """Async Redis client wrapper for Cognix caching layer."""

    def __init__(self):
        self.client: Optional[redis.Redis] = None

    async def connect(self):
        """Initialize Redis connection."""
        kwargs = {
            "host": settings.REDIS_HOST,
            "port": settings.REDIS_PORT,
            "db": settings.REDIS_DB,
            "decode_responses": True,
        }
        if settings.REDIS_PASSWORD:
            kwargs["password"] = settings.REDIS_PASSWORD
        self.client = redis.Redis(**kwargs)

    async def close(self):
        """Close Redis connection."""
        if self.client:
            await self.client.close()

    async def get_json(self, key: str) -> Optional[Any]:
        """Get a JSON value by key."""
        data = await self.client.get(key)
        return json.loads(data) if data else None

    async def set_json(self, key: str, value: Any, ttl: int = 300):
        """Set a JSON value with TTL (seconds)."""
        await self.client.setex(key, ttl, json.dumps(value, default=str))

    async def delete(self, key: str):
        """Delete a key."""
        await self.client.delete(key)

    async def invalidate_pattern(self, pattern: str):
        """Batch delete keys matching a pattern."""
        keys = await self.client.keys(pattern)
        if keys:
            await self.client.delete(*keys)

    async def ping(self) -> bool:
        """Check Redis connectivity."""
        return await self.client.ping()
