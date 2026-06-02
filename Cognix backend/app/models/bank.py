from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime


class Bank(Base):
    __tablename__ = "bank"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    color = Column(String(7))
    user_id = Column(String(36), ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="banks")
    questions = relationship("Question", back_populates="bank", cascade="all, delete-orphan")
    practice_sessions = relationship("PracticeSession", back_populates="bank")
    exam_sessions = relationship("ExamSession", back_populates="bank")
