from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime


class Mistake(Base):
    __tablename__ = "mistake"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user.id"), nullable=False)
    question_id = Column(String(36), ForeignKey("question.id"), nullable=False)
    wrong_count = Column(Integer, default=1)
    last_wrong_at = Column(DateTime, default=datetime.utcnow)
    consecutive_correct = Column(Integer, default=0)
    is_mastered = Column(Boolean, default=False)

    user = relationship("User", back_populates="mistakes")
    question = relationship("Question", back_populates="mistakes")
