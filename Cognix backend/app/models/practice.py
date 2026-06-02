from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime


class PracticeSession(Base):
    __tablename__ = "practice_session"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user.id"), nullable=False)
    bank_id = Column(String(36), ForeignKey("bank.id"), nullable=False)
    mode = Column(String(20), nullable=False)
    total_count = Column(Integer, nullable=False)
    correct_count = Column(Integer, default=0)
    time_spent = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime)

    user = relationship("User", back_populates="practice_sessions")
    bank = relationship("Bank", back_populates="practice_sessions")
    details = relationship("PracticeDetail", back_populates="session", cascade="all, delete-orphan")


class PracticeDetail(Base):
    __tablename__ = "practice_detail"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("practice_session.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(36), ForeignKey("question.id"), nullable=False)
    user_answer = Column(String(50), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    time_spent = Column(Integer, default=0)
    order_index = Column(Integer, nullable=False)

    session = relationship("PracticeSession", back_populates="details")
    question = relationship("Question", back_populates="practice_details")
