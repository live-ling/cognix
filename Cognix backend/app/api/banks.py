from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user, get_redis
from app.models.user import User
from app.schemas.common import ApiResponse, PaginatedData
from app.schemas.bank import BankCreate, BankUpdate, BankOut, BankListItem
from app.services import bank_service
from app.utils.redis import RedisClient

router = APIRouter()


def _bank_to_frontend(bank_dict: dict) -> dict:
    """Convert backend bank dict (with 'title') to frontend format (with 'name')."""
    return {
        "id": bank_dict["id"],
        "name": bank_dict.get("title", bank_dict.get("name", "")),
        "description": bank_dict.get("description"),
        "color": bank_dict.get("color"),
        "question_count": bank_dict.get("question_count", 0),
        "created_at": bank_dict["created_at"],
        "updated_at": bank_dict["updated_at"],
    }


@router.get("", response_model=ApiResponse[PaginatedData[BankListItem]])
async def list_banks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    # Try cache for default page (no search, page 1)
    cache_key = f"banks:{current_user.id}:p{page}:s{page_size}" + (f":q{search}" if search else "")
    if not search:
        cached = await redis.get_json(cache_key)
        if cached:
            return ApiResponse(data=cached)

    items, total, page, page_size, has_next = await bank_service.list_banks(
        db, current_user.id, page, page_size, search
    )
    result = {
        "items": [_bank_to_frontend(b) for b in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": has_next,
    }

    # Cache for 120 seconds (only non-search queries)
    if not search:
        await redis.set_json(cache_key, result, ttl=120)

    return ApiResponse(data=result)


@router.post("", response_model=ApiResponse[BankOut], status_code=201)
async def create_bank(
    data: BankCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    bank = await bank_service.create_bank(db, data, current_user.id)
    # Invalidate bank list cache
    await redis.invalidate_pattern(f"banks:{current_user.id}:*")
    return ApiResponse(data={
        "id": bank.id,
        "name": bank.title,
        "description": bank.description,
        "color": bank.color,
        "question_count": 0,
        "created_at": bank.created_at,
        "updated_at": bank.updated_at,
    })


@router.get("/{bank_id}", response_model=ApiResponse[BankOut])
async def get_bank(
    bank_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bank = await bank_service.get_bank(db, bank_id, current_user.id)
    return ApiResponse(data=_bank_to_frontend(bank))


@router.put("/{bank_id}", response_model=ApiResponse[BankOut])
async def update_bank(
    bank_id: str,
    data: BankUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    result = await bank_service.update_bank(db, bank_id, data, current_user.id)
    await redis.invalidate_pattern(f"banks:{current_user.id}:*")
    return ApiResponse(data=_bank_to_frontend(result))


@router.delete("/{bank_id}", response_model=ApiResponse[dict])
async def delete_bank(
    bank_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    await bank_service.delete_bank(db, bank_id, current_user.id)
    await redis.invalidate_pattern(f"banks:{current_user.id}:*")
    return ApiResponse(data={"deleted": True})
