from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.question import Question
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
    # Fetch question to determine type for correct answer conversion
    question = await db.scalar(select(Question).where(Question.id == data.question_id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    qtype = question.type.value if hasattr(question.type, "value") else str(question.type)

    # Convert frontend answers array to backend answer string based on question type
    if qtype == "MULTIPLE":
        # Join multiple answers into sorted string (e.g., ["A","C"] -> "AC")
        answer = "".join(sorted(data.answers))
    elif qtype == "TRUE_FALSE":
        # Frontend sends letter labels ("A"/"B"), map to actual option text
        options = question.options or []
        if data.answers and data.answers[0] in ("A", "B"):
            idx = ord(data.answers[0]) - ord("A")
            answer = options[idx] if idx < len(options) else data.answers[0]
        else:
            answer = data.answers[0] if data.answers else ""
    else:  # SINGLE
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
