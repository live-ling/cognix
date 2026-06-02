"""Schemas for file import and AI question generation."""

from pydantic import BaseModel, Field
from typing import Optional, List


class UploadResponse(BaseModel):
    """Response after uploading a file."""
    file_id: str
    filename: str
    preview: str
    char_count: int


class GenerateRequest(BaseModel):
    """Request to generate questions from an uploaded file."""
    file_id: str
    bank_id: Optional[str] = None          # Use existing bank
    bank_name: Optional[str] = None        # Or create new bank
    count: int = Field(10, ge=1, le=50)
    question_types: List[str] = Field(default_factory=lambda: ["single"])


class GeneratedQuestion(BaseModel):
    """A single generated question preview."""
    stem: str
    type: str
    options: List[str]
    answers: List[str]
    analysis: Optional[str] = None
    difficulty: str = "medium"


class GenerateResponse(BaseModel):
    """Response after generating questions."""
    bank_id: str
    bank_name: str
    created_count: int
    questions: List[GeneratedQuestion]
