from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class QuestionInMistake(BaseModel):
    """Frontend-compatible question in mistake: stem, answers, analysis."""
    id: str
    type: str
    stem: str
    options: List[str]
    answers: List[str]
    analysis: Optional[str] = None
    bank_title: str = ""

    model_config = {"from_attributes": True}


class MistakeOut(BaseModel):
    id: str
    question: QuestionInMistake
    wrong_count: int
    last_wrong_at: datetime
    consecutive_correct: int
    is_mastered: bool

    model_config = {"from_attributes": True}


class MistakeListItem(BaseModel):
    id: str
    question_id: str
    wrong_count: int
    last_wrong_at: datetime
    consecutive_correct: int
    is_mastered: bool

    model_config = {"from_attributes": True}


class BatchActionRequest(BaseModel):
    """Request body for batch operations on mistakes."""
    ids: List[str]
