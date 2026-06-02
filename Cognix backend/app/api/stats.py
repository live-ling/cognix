from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user, get_redis
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.stats import DashboardOut
from app.services import stats_service
from app.utils.redis import RedisClient

router = APIRouter()


@router.get("/dashboard", response_model=ApiResponse[DashboardOut])
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    cache_key = f"dashboard:{current_user.id}"

    # Try cache first
    cached = await redis.get_json(cache_key)
    if cached:
        return ApiResponse(data=cached)

    data = await stats_service.get_dashboard(db, current_user.id)

    # Cache for 60 seconds
    await redis.set_json(cache_key, data, ttl=60)

    return ApiResponse(data=data)
