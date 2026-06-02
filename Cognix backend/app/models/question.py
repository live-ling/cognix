from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
import enum
from datetime import datetime


class QuestionType(str, enum.Enum):
    SINGLE = "SINGLE"
    MULTIPLE = "MULTIPLE"
    TRUE_FALSE = "TRUE_FALSE"


class Difficulty(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class Question(Base):
    __tablename__ = "question"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bank_id = Column(String(36), ForeignKey("bank.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(QuestionType), nullable=False)
    content = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)
    answer = Column(String(50), nullable=False)
    explanation = Column(Text)
    difficulty = Column(Enum(Difficulty), default=Difficulty.EASY)
    tags = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    bank = relationship("Bank", back_populates="questions")
    practice_details = relationship("PracticeDetail", back_populates="question")
    exam_details = relationship("ExamDetail", back_populates="question")
    mistakes = relationship("Mistake", back_populates="question")
