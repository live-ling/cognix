from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime


class BankCreate(BaseModel):
    """Accept both 'name' and 'title' from frontend."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")

    @model_validator(mode="after")
    def ensure_title(self):
        if not self.title and self.name:
            self.title = self.name
        if not self.title:
            raise ValueError("Either 'name' or 'title' is required")
        return self


class BankUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class BankOut(BaseModel):
    """Frontend-compatible bank output: uses 'name' instead of 'title'."""
    id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    question_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BankListItem(BaseModel):
    """Frontend-compatible bank list item: uses 'name' instead of 'title'."""
    id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    question_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
