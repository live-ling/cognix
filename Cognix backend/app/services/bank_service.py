from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.bank import Bank
from app.models.question import Question
from app.schemas.bank import BankCreate, BankUpdate
from app.utils.pagination import paginate


async def list_banks(
    db: AsyncSession,
    user_id: str,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
):
    query = (
        select(Bank)
        .where(Bank.user_id == user_id)
    )
    if search:
        query = query.where(Bank.title.contains(search))

    query = query.order_by(Bank.updated_at.desc())

    banks, total, has_next = await paginate(db, query, page, page_size)

    # Build list items with question counts
    bank_ids = [b.id for b in banks]
    if bank_ids:
        count_query = (
            select(Question.bank_id, func.count(Question.id).label("cnt"))
            .where(Question.bank_id.in_(bank_ids))
            .group_by(Question.bank_id)
        )
        counts = {row.bank_id: row.cnt for row in (await db.execute(count_query)).all()}
    else:
        counts = {}

    items = []
    for b in banks:
        items.append({
            "id": b.id,
            "title": b.title,
            "description": b.description,
            "color": b.color,
            "question_count": counts.get(b.id, 0),
            "created_at": b.created_at,
            "updated_at": b.updated_at,
        })
    return items, total, page, page_size, has_next


async def get_bank(db: AsyncSession, bank_id: str, user_id: str) -> dict:
    bank = await db.execute(
        select(Bank).where(Bank.id == bank_id, Bank.user_id == user_id)
    )
    bank = bank.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    count = await db.scalar(
        select(func.count(Question.id)).where(Question.bank_id == bank_id)
    )
    return {
        "id": bank.id,
        "title": bank.title,
        "description": bank.description,
        "color": bank.color,
        "user_id": bank.user_id,
        "question_count": count or 0,
        "created_at": bank.created_at,
        "updated_at": bank.updated_at,
    }


async def create_bank(db: AsyncSession, data: BankCreate, user_id: str) -> Bank:
    # model_validator ensures title is set (from name if needed)
    bank = Bank(
        title=data.title,
        description=data.description,
        color=data.color,
        user_id=user_id,
    )
    db.add(bank)
    await db.flush()
    return bank


async def update_bank(db: AsyncSession, bank_id: str, data: BankUpdate, user_id: str) -> dict:
    bank = await db.scalar(
        select(Bank).where(Bank.id == bank_id, Bank.user_id == user_id)
    )
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    update_data = data.model_dump(exclude_unset=True)
    # Handle name -> title mapping
    if "name" in update_data and "title" not in update_data:
        update_data["title"] = update_data.pop("name")
    elif "name" in update_data and "title" in update_data:
        update_data.pop("name")  # title takes precedence
    else:
        update_data.pop("name", None)

    for key, value in update_data.items():
        setattr(bank, key, value)
    await db.flush()

    count = await db.scalar(
        select(func.count(Question.id)).where(Question.bank_id == bank_id)
    )
    return {
        "id": bank.id,
        "title": bank.title,
        "description": bank.description,
        "color": bank.color,
        "user_id": bank.user_id,
        "question_count": count or 0,
        "created_at": bank.created_at,
        "updated_at": bank.updated_at,
    }


async def delete_bank(db: AsyncSession, bank_id: str, user_id: str) -> bool:
    bank = await db.scalar(
        select(Bank).where(Bank.id == bank_id, Bank.user_id == user_id)
    )
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    await db.delete(bank)
    await db.flush()
    return True
