from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse, PaginatedData
from app.schemas.question import (
    QuestionCreate, QuestionUpdate, QuestionOut, QuestionListItem,
    QuestionSessionItem,
)
from app.services import question_service

# All question routes are bank-scoped: /api/banks/{bank_id}/questions/...
router = APIRouter()


@router.get("", response_model=ApiResponse[PaginatedData[QuestionListItem]])
async def list_questions(
    bank_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None, alias="type"),
    difficulty: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total, page, page_size, has_next = await question_service.list_questions(
        db, bank_id, current_user.id, page, page_size, type, difficulty, search,
    )
    return ApiResponse(data={
        "items": [QuestionListItem.from_model(q) for q in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": has_next,
    })


@router.post("", response_model=ApiResponse[QuestionOut], status_code=201)
async def create_question(
    bank_id: str,
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await question_service.create_question(db, bank_id, data, current_user.id)
    return ApiResponse(data=QuestionOut.from_model(question))


@router.get("/{question_id}", response_model=ApiResponse[QuestionOut])
async def get_question(
    bank_id: str,
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await question_service.get_question(db, question_id)
    return ApiResponse(data=QuestionOut.from_model(question))


@router.put("/{question_id}", response_model=ApiResponse[QuestionOut])
async def update_question(
    bank_id: str,
    question_id: str,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await question_service.update_question(db, question_id, data)
    return ApiResponse(data=QuestionOut.from_model(question))


@router.delete("/{question_id}", response_model=ApiResponse[dict])
async def delete_question(
    bank_id: str,
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await question_service.delete_question(db, question_id)
    return ApiResponse(data={"deleted": True})
