from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime


class ExamSession(Base):
    __tablename__ = "exam_session"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user.id"), nullable=False)
    bank_id = Column(String(36), ForeignKey("bank.id"), nullable=False)
    total_count = Column(Integer, nullable=False)
    correct_count = Column(Integer, default=0)
    score = Column(Integer, default=0)
    time_limit = Column(Integer, nullable=False)
    time_spent = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime)

    user = relationship("User", back_populates="exam_sessions")
    bank = relationship("Bank", back_populates="exam_sessions")
    details = relationship("ExamDetail", back_populates="session", cascade="all, delete-orphan")


class ExamDetail(Base):
    __tablename__ = "exam_detail"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("exam_session.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(36), ForeignKey("question.id"), nullable=False)
    user_answer = Column(String(50))
    is_correct = Column(Boolean)
    is_marked = Column(Boolean, default=False)
    order_index = Column(Integer, nullable=False)

    session = relationship("ExamSession", back_populates="details")
    question = relationship("Question", back_populates="exam_details")
