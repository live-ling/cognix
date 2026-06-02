from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime


class User(Base):
    __tablename__ = "user"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100))
    email = Column(String(255), unique=True)
    password_hash = Column(String(255), nullable=True)
    bio = Column(String(500), nullable=True, default="")
    ai_api_key = Column(String(255), nullable=True, default="")
    ai_base_url = Column(String(500), nullable=True, default="")
    ai_model = Column(String(100), nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    banks = relationship("Bank", back_populates="user")
    practice_sessions = relationship("PracticeSession", back_populates="user")
    exam_sessions = relationship("ExamSession", back_populates="user")
    mistakes = relationship("Mistake", back_populates="user")
    learning_logs = relationship("LearningLog", back_populates="user")
