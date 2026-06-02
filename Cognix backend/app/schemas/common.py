from pydantic import BaseModel
from typing import TypeVar, Generic, Optional, List

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Unified API response envelope."""
    success: bool = True
    data: Optional[T] = None
    error: Optional[str] = None
    code: Optional[str] = None


class PaginatedData(BaseModel, Generic[T]):
    """Paginated response wrapper."""
    items: List[T]
    total: int
    page: int
    page_size: int
    has_next: bool
