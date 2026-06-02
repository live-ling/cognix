import math
from datetime import date, timedelta

from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank import Bank
from app.models.question import Question
from app.models.practice import PracticeSession, PracticeDetail
from app.models.learning_log import LearningLog


async def get_dashboard(db: AsyncSession, user_id: str) -> dict:
    today = date.today()

    # 1. Today's count and accuracy
    today_stats = await db.execute(
        select(
            func.count(PracticeDetail.id).label("total"),
            func.sum(case((PracticeDetail.is_correct == True, 1), else_=0)).label("correct"),  # noqa: E712
        )
        .join(PracticeSession, PracticeDetail.session_id == PracticeSession.id)
        .where(
            PracticeSession.user_id == user_id,
            func.date(PracticeSession.started_at) == today,
            PracticeSession.is_completed == True,  # noqa: E712
        )
    )
    row = today_stats.one()
    today_count = row.total or 0
    # Frontend expects accuracy as decimal (0.0-1.0)
    today_accuracy = round(row.correct / row.total, 3) if row.total else 0.0

    # 2. Streak days
    streak_days = await _calculate_streak(db, user_id)

    # 3. Total banks and questions
    bank_count = await db.scalar(
        select(func.count(Bank.id)).where(Bank.user_id == user_id)
    ) or 0

    total_questions = await db.scalar(
        select(func.count(Question.id))
        .join(Bank, Question.bank_id == Bank.id)
        .where(Bank.user_id == user_id)
    ) or 0

    # 4. Average accuracy (all time)
    all_time_stats = await db.execute(
        select(
            func.count(PracticeDetail.id).label("total"),
            func.sum(case((PracticeDetail.is_correct == True, 1), else_=0)).label("correct"),  # noqa: E712
        )
        .join(PracticeSession, PracticeDetail.session_id == PracticeSession.id)
        .where(
            PracticeSession.user_id == user_id,
            PracticeSession.is_completed == True,  # noqa: E712
        )
    )
    all_row = all_time_stats.one()
    avg_accuracy = round(all_row.correct / all_row.total, 3) if all_row.total else 0.0

    # 5. Max streak (from learning logs)
    max_streak = await _calculate_max_streak(db, user_id)

    # 6. Heatmap (last 365 days)
    heatmap = await _get_heatmap(db, user_id, days=365)

    # 7. Recent sessions
    recent_sessions = await _get_recent_sessions(db, user_id, limit=10)

    return {
        "today_answered": today_count,
        "accuracy": today_accuracy,
        "streak_days": streak_days,
        "bank_count": bank_count,
        "total_questions": total_questions,
        "avg_accuracy": avg_accuracy,
        "max_streak": max_streak,
        "heatmap": heatmap,
        "recent_sessions": recent_sessions,
    }


async def _calculate_streak(db: AsyncSession, user_id: str) -> int:
    """Calculate consecutive learning days from today backwards."""
    logs = await db.execute(
        select(LearningLog.date)
        .where(LearningLog.user_id == user_id)
        .order_by(LearningLog.date.desc())
    )
    dates = [row.date for row in logs.all()]

    if not dates:
        return 0

    today = date.today()
    if dates[0] != today:
        if dates[0] == today - timedelta(days=1):
            check_date = today - timedelta(days=1)
        else:
            return 0
    else:
        check_date = today

    streak = 0
    for d in dates:
        if d == check_date:
            streak += 1
            check_date = check_date - timedelta(days=1)
        elif d < check_date:
            break

    return streak


async def _calculate_max_streak(db: AsyncSession, user_id: str) -> int:
    """Calculate the maximum consecutive learning streak."""
    logs = await db.execute(
        select(LearningLog.date)
        .where(LearningLog.user_id == user_id)
        .order_by(LearningLog.date.asc())
    )
    dates = [row.date for row in logs.all()]

    if not dates:
        return 0

    max_streak = 1
    current_streak = 1

    for i in range(1, len(dates)):
        if dates[i] == dates[i - 1] + timedelta(days=1):
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        elif dates[i] != dates[i - 1]:
            current_streak = 1

    return max_streak


async def _get_heatmap(db: AsyncSession, user_id: str, days: int = 365) -> list[dict]:
    """Get daily answer counts for the heatmap."""
    start_date = date.today() - timedelta(days=days - 1)
    logs = await db.execute(
        select(LearningLog.date, LearningLog.count)
        .where(
            LearningLog.user_id == user_id,
            LearningLog.date >= start_date,
        )
        .order_by(LearningLog.date)
    )
    log_map = {row.date.isoformat(): row.count for row in logs.all()}

    heatmap = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        ds = d.isoformat()
        heatmap.append({"date": ds, "count": log_map.get(ds, 0)})
    return heatmap


async def _get_recent_sessions(db: AsyncSession, user_id: str, limit: int = 10) -> list[dict]:
    """Get recent completed practice sessions in frontend-compatible format."""
    sessions = await db.execute(
        select(PracticeSession, Bank.title)
        .join(Bank, PracticeSession.bank_id == Bank.id)
        .where(
            PracticeSession.user_id == user_id,
            PracticeSession.is_completed == True,  # noqa: E712
        )
        .order_by(PracticeSession.started_at.desc())
        .limit(limit)
    )
    rows = sessions.all()
    result = []
    for session, bank_title in rows:
        # Accuracy as decimal (0.0-1.0)
        accuracy = round(session.correct_count / session.total_count, 3) if session.total_count > 0 else 0.0
        # Format duration as "Xm Ys"
        total_secs = session.time_spent or 0
        mins = total_secs // 60
        secs = total_secs % 60
        duration = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"

        # Format date
        date_str = session.started_at.strftime("%Y-%m-%d") if session.started_at else ""

        result.append({
            "date": date_str,
            "mode": session.mode,
            "correct": session.correct_count,
            "total": session.total_count,
            "accuracy": accuracy,
            "duration": duration,
        })
    return result
