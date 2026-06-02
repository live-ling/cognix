from pydantic import BaseModel, Field, model_validator, field_validator
from typing import Optional, List, Literal
from datetime import datetime


# ============================================================
# Type/difficulty conversion helpers
# ============================================================

_TYPE_TO_BACKEND = {
    "single": "SINGLE", "multiple": "MULTIPLE", "judgement": "TRUE_FALSE",
    "SINGLE": "SINGLE", "MULTIPLE": "MULTIPLE", "TRUE_FALSE": "TRUE_FALSE",
    "TRUE_FALSE": "TRUE_FALSE",
}
_TYPE_TO_FRONTEND = {
    "SINGLE": "single", "MULTIPLE": "multiple", "TRUE_FALSE": "judgement",
}
_DIFF_TO_BACKEND = {
    "easy": "EASY", "medium": "MEDIUM", "hard": "HARD",
    "EASY": "EASY", "MEDIUM": "MEDIUM", "HARD": "HARD",
}
_DIFF_TO_FRONTEND = {
    "EASY": "easy", "MEDIUM": "medium", "HARD": "hard",
}


def to_backend_type(t: str) -> str:
    result = _TYPE_TO_BACKEND.get(t)
    if not result:
        raise ValueError(f"Invalid question type: {t}")
    return result


def to_frontend_type(t: str) -> str:
    return _TYPE_TO_FRONTEND.get(t, t.lower())


def to_backend_diff(d: str) -> str:
    result = _DIFF_TO_BACKEND.get(d)
    if not result:
        raise ValueError(f"Invalid difficulty: {d}")
    return result


def to_frontend_diff(d: str) -> str:
    return _DIFF_TO_FRONTEND.get(d, d.lower())


# ============================================================
# Internal (backend) schemas - used by services/models
# ============================================================

class QuestionCreateInternal(BaseModel):
    """Internal format for creating a question (backend enum values)."""
    type: str
    content: str
    options: List[str]
    answer: str
    explanation: Optional[str] = None
    difficulty: str = "EASY"
    tags: Optional[List[str]] = None


class QuestionUpdateInternal(BaseModel):
    """Internal format for updating a question."""
    type: Optional[str] = None
    content: Optional[str] = None
    options: Optional[List[str]] = None
    answer: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = None
    tags: Optional[List[str]] = None


# ============================================================
# Frontend-compatible schemas
# ============================================================

class QuestionCreate(BaseModel):
    """Frontend-compatible question creation.
    Accepts frontend field names: stem, answers, analysis, lowercase type/difficulty.
    """
    stem: str = Field(..., min_length=1, alias="content")
    type: str
    options: List[str] = Field(..., min_length=2, max_length=6)
    answers: List[str] = Field(..., min_length=1)
    analysis: Optional[str] = Field(None, alias="explanation")
    difficulty: str = "medium"
    tags: Optional[List[str]] = None

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_and_convert(self):
        # Convert type to backend format
        self._backend_type = to_backend_type(self.type)
        self._backend_diff = to_backend_diff(self.difficulty)

        # Convert answers array to single answer string
        if self._backend_type == "SINGLE":
            if len(self.answers) != 1 or self.answers[0] not in "ABCDEF":
                raise ValueError("SINGLE answer must be a single letter A-F")
            self._answer_str = self.answers[0]
        elif self._backend_type == "MULTIPLE":
            for a in self.answers:
                if a not in "ABCDEF":
                    raise ValueError("MULTIPLE answers must be uppercase letters A-F only")
            if len(set(self.answers)) != len(self.answers):
                raise ValueError("MULTIPLE answers must not contain duplicates")
            self._answer_str = "".join(sorted(self.answers))
        elif self._backend_type == "TRUE_FALSE":
            if len(self.answers) != 1 or self.answers[0] not in ("正确", "错误"):
                raise ValueError("TRUE_FALSE answer must be '正确' or '错误'")
            self._answer_str = self.answers[0]
            self.options = ["正确", "错误"]
        return self

    @field_validator("options")
    @classmethod
    def validate_options(cls, v):
        if len(set(v)) != len(v):
            raise ValueError("Options must not contain duplicates")
        return v

    def to_internal(self) -> QuestionCreateInternal:
        """Convert to internal backend format."""
        return QuestionCreateInternal(
            type=self._backend_type,
            content=self.stem,
            options=self.options,
            answer=self._answer_str,
            explanation=self.analysis,
            difficulty=self._backend_diff,
            tags=self.tags,
        )


class QuestionUpdate(BaseModel):
    """Frontend-compatible question update."""
    stem: Optional[str] = Field(None, min_length=1, alias="content")
    type: Optional[str] = None
    options: Optional[List[str]] = Field(None, min_length=2, max_length=6)
    answers: Optional[List[str]] = None
    analysis: Optional[str] = Field(None, alias="explanation")
    difficulty: Optional[str] = None
    tags: Optional[List[str]] = None

    model_config = {"populate_by_name": True}

    def to_internal(self) -> QuestionUpdateInternal:
        """Convert to internal backend format."""
        kwargs = {}
        if self.stem is not None:
            kwargs["content"] = self.stem
        if self.type is not None:
            kwargs["type"] = to_backend_type(self.type)
        if self.options is not None:
            kwargs["options"] = self.options
        if self.answers is not None:
            backend_type = to_backend_type(self.type) if self.type else None
            if backend_type == "MULTIPLE":
                kwargs["answer"] = "".join(sorted(self.answers))
            elif self.answers:
                kwargs["answer"] = self.answers[0]
        if self.analysis is not None:
            kwargs["explanation"] = self.analysis
        if self.difficulty is not None:
            kwargs["difficulty"] = to_backend_diff(self.difficulty)
        if self.tags is not None:
            kwargs["tags"] = self.tags
        return QuestionUpdateInternal(**kwargs)


class QuestionOut(BaseModel):
    """Frontend-compatible question output.
    Maps backend fields to frontend field names:
      content -> stem, answer -> answers, explanation -> analysis
    """
    id: str
    bank_id: str
    type: str
    stem: str
    options: List[str]
    answers: List[str]
    analysis: Optional[str] = None
    difficulty: str
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, q) -> "QuestionOut":
        """Convert from ORM model to frontend-compatible output."""
        answer = q.answer or ""
        # Convert single answer string to array
        if hasattr(q.type, "value"):
            qtype = q.type.value
        else:
            qtype = str(q.type)

        if qtype == "MULTIPLE":
            answers = list(answer)
        else:
            answers = [answer]

        return cls(
            id=q.id,
            bank_id=q.bank_id,
            type=to_frontend_type(qtype),
            stem=q.content,
            options=q.options or [],
            answers=answers,
            analysis=q.explanation,
            difficulty=to_frontend_diff(
                q.difficulty.value if hasattr(q.difficulty, "value") else str(q.difficulty)
            ),
            tags=q.tags,
            created_at=q.created_at,
            updated_at=q.updated_at,
        )


class QuestionListItem(BaseModel):
    """Frontend-compatible question list item."""
    id: str
    bank_id: str
    type: str
    stem: str
    options: List[str]
    answers: List[str]
    analysis: Optional[str] = None
    difficulty: str
    tags: Optional[List[str]] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, q) -> "QuestionListItem":
        """Convert from ORM model."""
        answer = q.answer or ""
        qtype = q.type.value if hasattr(q.type, "value") else str(q.type)
        if qtype == "MULTIPLE":
            answers = list(answer)
        else:
            answers = [answer]

        return cls(
            id=q.id,
            bank_id=q.bank_id,
            type=to_frontend_type(qtype),
            stem=q.content,
            options=q.options or [],
            answers=answers,
            analysis=q.explanation,
            difficulty=to_frontend_diff(
                q.difficulty.value if hasattr(q.difficulty, "value") else str(q.difficulty)
            ),
            tags=q.tags,
            created_at=q.created_at,
        )


class QuestionSessionItem(BaseModel):
    """Question in practice/exam session (NO answer or explanation).
    Frontend-compatible field names.
    """
    id: str
    type: str
    stem: str
    options: List[str]
    order_index: int

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, q, order_index: int) -> "QuestionSessionItem":
        """Convert from ORM model."""
        qtype = q.type.value if hasattr(q.type, "value") else str(q.type)
        return cls(
            id=q.id,
            type=to_frontend_type(qtype),
            stem=q.content,
            options=q.options or [],
            order_index=order_index,
        )
