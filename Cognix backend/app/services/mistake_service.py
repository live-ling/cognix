from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from fastapi import HTTPException

from app.models.mistake import Mistake
from app.models.question import Question
from app.models.bank import Bank
from app.schemas.question import to_frontend_type
from app.utils.pagination import paginate


async def list_mistakes(
    db: AsyncSession,
    user_id: str,
    bank_id: str | None = None,
    is_mastered: bool | None = None,
    page: int = 1,
    page_size: int = 20,
):
    query = (
        select(Mistake)
        .options(joinedload(Mistake.question).joinedload(Question.bank))
        .where(Mistake.user_id == user_id)
    )

    if bank_id:
        query = query.join(Question, Mistake.question_id == Question.id).where(
            Question.bank_id == bank_id
        )
    if is_mastered is not None:
        query = query.where(Mistake.is_mastered == is_mastered)

    query = query.order_by(Mistake.last_wrong_at.desc())

    mistakes, total, has_next = await paginate(db, query, page, page_size)

    # Build items — bank title comes from joinedload, no extra queries
    items = []
    for m in mistakes:
        question = m.question
        bank_title = question.bank.title if question.bank else ""

        qtype = question.type.value if hasattr(question.type, "value") else str(question.type)
        answer = question.answer or ""
        if qtype == "MULTIPLE":
            answers = list(answer)
        else:
            answers = [answer]

        items.append({
            "id": m.id,
            "question": {
                "id": question.id,
                "type": to_frontend_type(qtype),
                "stem": question.content,
                "options": question.options,
                "answers": answers,
                "analysis": question.explanation,
                "bank_title": bank_title,
            },
            "wrong_count": m.wrong_count,
            "last_wrong_at": m.last_wrong_at,
            "consecutive_correct": m.consecutive_correct,
            "is_mastered": m.is_mastered,
        })
    return items, total, page, page_size, has_next


async def mark_mastered(db: AsyncSession, mistake_id: str, user_id: str) -> dict:
    mistake = await db.scalar(
        select(Mistake).where(
            Mistake.id == mistake_id,
            Mistake.user_id == user_id,
        )
    )
    if not mistake:
        raise HTTPException(status_code=404, detail="Mistake not found")

    mistake.is_mastered = True
    await db.flush()
    return {"is_mastered": True}


async def delete_mistake(db: AsyncSession, mistake_id: str, user_id: str) -> bool:
    mistake = await db.scalar(
        select(Mistake).where(
            Mistake.id == mistake_id,
            Mistake.user_id == user_id,
        )
    )
    if not mistake:
        raise HTTPException(status_code=404, detail="Mistake not found")

    await db.delete(mistake)
    await db.flush()
    return True


async def batch_delete_mistakes(db: AsyncSession, ids: list[str], user_id: str) -> int:
    """Batch delete mistakes by IDs. Returns count of deleted items."""
    mistakes = await db.scalars(
        select(Mistake).where(
            Mistake.id.in_(ids),
            Mistake.user_id == user_id,
        )
    )
    count = 0
    for m in mistakes.all():
        await db.delete(m)
        count += 1
    await db.flush()
    return count


async def batch_mark_mastered(db: AsyncSession, ids: list[str], user_id: str) -> int:
    """Batch mark mistakes as mastered. Returns count of updated items."""
    mistakes = await db.scalars(
        select(Mistake).where(
            Mistake.id.in_(ids),
            Mistake.user_id == user_id,
        )
    )
    count = 0
    for m in mistakes.all():
        if not m.is_mastered:
            m.is_mastered = True
            count += 1
    await db.flush()
    return count
