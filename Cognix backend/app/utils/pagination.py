from typing import Any
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def paginate(
    db: AsyncSession,
    query: Select,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Any], int, bool]:
    """
    Execute a query with OFFSET/LIMIT pagination.

    Returns:
        tuple of (items, total_count, has_next)
    """
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    paginated_query = query.offset(offset).limit(page_size)
    result = await db.execute(paginated_query)
    items = list(result.scalars().all())

    has_next = (offset + page_size) < total
    return items, total, has_next
