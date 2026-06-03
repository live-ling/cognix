"""Schemas for file import and AI question generation."""

from pydantic import BaseModel, Field, model_validator
from typing import Optional, List


class UploadResponse(BaseModel):
    """Response after uploading a file."""
    file_id: str
    filename: str
    preview: str
    char_count: int


class GenerateRequest(BaseModel):
    """Request to generate questions from uploaded file or pasted text."""
    file_id: Optional[str] = None          # From file upload
    text: Optional[str] = None             # From direct paste
    bank_id: Optional[str] = None          # Use existing bank (for context, not saving)
    count: int = Field(10, ge=1, le=50)
    question_types: List[str] = Field(default_factory=lambda: ["single"])
    # Material mode: per-type counts
    material_mode: bool = False
    single_count: int = Field(5, ge=0, le=20)
    multiple_count: int = Field(3, ge=0, le=20)
    judgement_count: int = Field(2, ge=0, le=20)

    @model_validator(mode="after")
    def check_source(self):
        if not self.file_id and not self.text:
            raise ValueError("必须提供 file_id 或 text")
        return self


class GeneratedQuestion(BaseModel):
    """A single generated question preview."""
    stem: str
    type: str
    options: List[str]
    answers: List[str]
    analysis: Optional[str] = None
    difficulty: str = "medium"


class GenerateResponse(BaseModel):
    """Response after generating questions (not saved yet)."""
    questions: List[GeneratedQuestion]


class SaveQuestionsRequest(BaseModel):
    """Request to save reviewed questions to a bank."""
    bank_id: str = Field(..., min_length=1)
    questions: List[GeneratedQuestion] = Field(..., min_length=1)


class SaveQuestionsResponse(BaseModel):
    """Response after saving questions."""
    bank_id: str
    bank_name: str
    created_count: int
