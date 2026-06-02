from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


class PracticeStartRequest(BaseModel):
    bank_id: str = Field(..., min_length=1)
    mode: Literal["sequential", "random", "mistake"] = "random"
    count: int = Field(default=20, ge=5, le=100)


class PracticeSubmitRequest(BaseModel):
    """Frontend sends 'answers' array, not single 'answer'."""
    session_id: str = Field(..., min_length=1)
    question_id: str = Field(..., min_length=1)
    answers: List[str] = Field(..., min_length=1)
    time_spent: int = Field(default=0, ge=0)


class PracticeFinishRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    time_spent: int = Field(default=0, ge=0)


class PracticeStartOut(BaseModel):
    session_id: str
    questions: List["QuestionSessionItem"]
    total_count: int


class PracticeSubmitOut(BaseModel):
    """Frontend-compatible: correct_answers as array, analysis instead of explanation."""
    is_correct: bool
    correct_answers: List[str]
    analysis: Optional[str] = None


class PracticeDetailOut(BaseModel):
    """Frontend-compatible: stem instead of content."""
    stem: str
    user_answer: str
    correct_answer: str
    is_correct: bool
    time_spent: int


class PracticeFinishOut(BaseModel):
    """Frontend-compatible: nested under 'detail' with 'questions' array."""
    session_id: str
    total_count: int
    correct_count: int
    accuracy: float
    time_spent: int
    details: List[PracticeDetailOut]


# Fix forward reference
from app.schemas.question import QuestionSessionItem  # noqa: E402
PracticeStartOut.model_rebuild()
