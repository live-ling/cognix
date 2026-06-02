from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class HeatmapPoint(BaseModel):
    date: str
    count: int


class TrendPoint(BaseModel):
    date: str
    count: int
    accuracy: float


class RadarData(BaseModel):
    accuracy: float
    volume: float
    speed: float
    coverage: float
    persistence: float


class RecentSession(BaseModel):
    """Frontend-compatible recent session format."""
    date: str
    mode: str
    correct: int
    total: int
    accuracy: float
    duration: str


class DashboardOut(BaseModel):
    """Frontend-compatible dashboard output.
    Field names match what the frontend DashboardStats type expects.
    """
    today_answered: int
    accuracy: float
    streak_days: int
    bank_count: int
    total_questions: int
    avg_accuracy: float
    max_streak: int
    heatmap: List[HeatmapPoint]
    recent_sessions: List[RecentSession]


class Achievement(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    unlocked: bool
    unlocked_at: Optional[datetime] = None
    progress: Optional[dict] = None


class AchievementListOut(BaseModel):
    achievements: List[Achievement]
