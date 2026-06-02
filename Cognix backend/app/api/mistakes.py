from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse, PaginatedData
from app.schemas.mistake import MistakeOut, BatchActionRequest
from app.services import mistake_service

router = APIRouter()


@router.get("", response_model=ApiResponse[PaginatedData[MistakeOut]])
async def list_mistakes(
    bank_id: str | None = Query(None),
    is_mastered: bool | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total, page, page_size, has_next = await mistake_service.list_mistakes(
        db, current_user.id, bank_id, is_mastered, page, page_size,
    )
    return ApiResponse(data={
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": has_next,
    })


# Frontend sends POST, accept both POST and PUT
@router.post("/{mistake_id}/master", response_model=ApiResponse[dict])
@router.put("/{mistake_id}/master", response_model=ApiResponse[dict])
async def mark_mastered(
    mistake_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await mistake_service.mark_mastered(db, mistake_id, current_user.id)
    return ApiResponse(data=result)


@router.delete("/{mistake_id}", response_model=ApiResponse[dict])
async def delete_mistake(
    mistake_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await mistake_service.delete_mistake(db, mistake_id, current_user.id)
    return ApiResponse(data={"deleted": True})


@router.post("/batch/delete", response_model=ApiResponse[dict])
async def batch_delete_mistakes(
    data: BatchActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await mistake_service.batch_delete_mistakes(db, data.ids, current_user.id)
    return ApiResponse(data={"deleted_count": count})


@router.post("/batch/master", response_model=ApiResponse[dict])
async def batch_mark_mastered(
    data: BatchActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await mistake_service.batch_mark_mastered(db, data.ids, current_user.id)
    return ApiResponse(data={"mastered_count": count})
