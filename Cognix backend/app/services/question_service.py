from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.question import Question, QuestionType, Difficulty
from app.models.bank import Bank
from app.schemas.question import (
    QuestionCreate, QuestionUpdate,
    to_backend_type, to_backend_diff,
)
from app.utils.pagination import paginate


async def list_questions(
    db: AsyncSession,
    bank_id: str,
    user_id: str,
    page: int = 1,
    page_size: int = 20,
    type_filter: str | None = None,
    difficulty_filter: str | None = None,
    search: str | None = None,
):
    # Verify bank ownership
    bank = await db.scalar(
        select(Bank).where(Bank.id == bank_id, Bank.user_id == user_id)
    )
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    query = select(Question).where(Question.bank_id == bank_id)

    if type_filter:
        try:
            backend_type = to_backend_type(type_filter)
            query = query.where(Question.type == backend_type)
        except ValueError:
            pass  # ignore invalid type filter
    if difficulty_filter:
        try:
            backend_diff = to_backend_diff(difficulty_filter)
            query = query.where(Question.difficulty == backend_diff)
        except ValueError:
            pass  # ignore invalid difficulty filter
    if search:
        query = query.where(Question.content.contains(search))

    query = query.order_by(Question.created_at.desc())

    items, total, has_next = await paginate(db, query, page, page_size)
    return items, total, page, page_size, has_next


async def get_question(db: AsyncSession, question_id: str) -> Question:
    question = await db.scalar(
        select(Question).where(Question.id == question_id)
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


async def create_question(
    db: AsyncSession,
    bank_id: str,
    data: QuestionCreate,
    user_id: str,
) -> Question:
    # Verify bank ownership
    bank = await db.scalar(
        select(Bank).where(Bank.id == bank_id, Bank.user_id == user_id)
    )
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    # Convert frontend format to internal format
    internal = data.to_internal()

    question = Question(
        bank_id=bank_id,
        type=internal.type,
        content=internal.content,
        options=internal.options,
        answer=internal.answer,
        explanation=internal.explanation,
        difficulty=internal.difficulty,
        tags=internal.tags,
    )
    db.add(question)
    await db.flush()
    return question


async def update_question(
    db: AsyncSession,
    question_id: str,
    data: QuestionUpdate,
) -> Question:
    question = await db.scalar(
        select(Question).where(Question.id == question_id)
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    internal = data.to_internal()
    update_data = internal.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(question, key, value)
    await db.flush()
    return question


async def delete_question(db: AsyncSession, question_id: str) -> bool:
    question = await db.scalar(
        select(Question).where(Question.id == question_id)
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    await db.delete(question)
    await db.flush()
    return True
