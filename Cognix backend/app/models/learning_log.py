from sqlalchemy import Column, String, Integer, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class LearningLog(Base):
    __tablename__ = "learning_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user.id"), nullable=False)
    date = Column(Date, nullable=False)
    count = Column(Integer, default=0)
    correct = Column(Integer, default=0)

    user = relationship("User", back_populates="learning_logs")
