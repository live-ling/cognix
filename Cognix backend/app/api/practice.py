from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.practice import (
    PracticeStartRequest, PracticeSubmitRequest, PracticeFinishRequest,
    PracticeStartOut, PracticeSubmitOut, PracticeFinishOut,
)
from app.services import practice_service

router = APIRouter()


@router.post("/start", response_model=ApiResponse[PracticeStartOut])
async def start_practice(
    data: PracticeStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await practice_service.start_practice(db, data, current_user.id)
    return ApiResponse(data=result)


@router.post("/submit", response_model=ApiResponse[PracticeSubmitOut])
async def submit_answer(
    data: PracticeSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Frontend sends 'answers' array; convert to single answer string for backend
    answer = data.answers[0] if data.answers else ""
    result = await practice_service.submit_answer(
        db,
        session_id=data.session_id,
        question_id=data.question_id,
        answer=answer,
        time_spent=data.time_spent,
        user_id=current_user.id,
    )
    return ApiResponse(data=result)


@router.post("/finish", response_model=ApiResponse[PracticeFinishOut])
async def finish_practice(
    data: PracticeFinishRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await practice_service.finish_practice(
        db,
        session_id=data.session_id,
        time_spent=data.time_spent,
        user_id=current_user.id,
    )
    return ApiResponse(data=result)
