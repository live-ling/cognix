import random
from datetime import datetime, date

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.bank import Bank
from app.models.question import Question
from app.models.practice import PracticeSession, PracticeDetail
from app.models.mistake import Mistake
from app.models.learning_log import LearningLog
from app.schemas.practice import PracticeStartRequest
from app.schemas.question import to_frontend_type, to_frontend_diff


async def start_practice(
    db: AsyncSession,
    data: PracticeStartRequest,
    user_id: str,
) -> dict:
    # Verify bank exists and belongs to user
    bank = await db.scalar(
        select(Bank).where(Bank.id == data.bank_id, Bank.user_id == user_id)
    )
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    # Fetch questions based on mode
    if data.mode == "mistake":
        question_query = (
            select(Question)
            .join(Mistake, and_(
                Mistake.question_id == Question.id,
                Mistake.user_id == user_id,
                Mistake.is_mastered == False,  # noqa: E712
            ))
            .where(Question.bank_id == data.bank_id)
            .limit(data.count)
        )
    elif data.mode == "sequential":
        question_query = (
            select(Question)
            .where(Question.bank_id == data.bank_id)
            .order_by(Question.created_at.asc())
            .limit(data.count)
        )
    else:  # random
        question_query = select(Question).where(Question.bank_id == data.bank_id)

    result = await db.execute(question_query)
    questions = list(result.scalars().all())

    if len(questions) == 0:
        raise HTTPException(status_code=400, detail="No questions available for this bank/mode")

    actual_count = min(data.count, len(questions))

    if data.mode == "random":
        random.shuffle(questions)
        questions = questions[:actual_count]
    else:
        questions = questions[:actual_count]

    # Create session
    session = PracticeSession(
        user_id=user_id,
        bank_id=data.bank_id,
        mode=data.mode,
        total_count=actual_count,
    )
    db.add(session)
    await db.flush()

    # Build response (no answers exposed) - frontend-compatible field names
    session_questions = [
        {
            "id": q.id,
            "type": to_frontend_type(q.type.value if hasattr(q.type, "value") else q.type),
            "stem": q.content,
            "options": q.options,
            "order_index": i,
        }
        for i, q in enumerate(questions)
    ]

    return {
        "session_id": session.id,
        "questions": session_questions,
        "total_count": actual_count,
    }


async def submit_answer(
    db: AsyncSession,
    session_id: str,
    question_id: str,
    answer: str,
    time_spent: int,
    user_id: str,
) -> dict:
    # Verify session
    session = await db.scalar(
        select(PracticeSession).where(
            PracticeSession.id == session_id,
            PracticeSession.user_id == user_id,
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.is_completed:
        raise HTTPException(status_code=400, detail="Session already completed")

    # Verify question
    question = await db.scalar(select(Question).where(Question.id == question_id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Check duplicate
    existing = await db.scalar(
        select(PracticeDetail).where(
            PracticeDetail.session_id == session_id,
            PracticeDetail.question_id == question_id,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Question already submitted")

    # Determine correctness
    is_correct = (answer == question.answer)

    # Get current order index
    count_result = await db.scalar(
        select(func.count(PracticeDetail.id)).where(
            PracticeDetail.session_id == session_id
        )
    )
    order_index = count_result or 0

    # Insert detail
    detail = PracticeDetail(
        session_id=session_id,
        question_id=question_id,
        user_answer=answer,
        is_correct=is_correct,
        time_spent=time_spent,
        order_index=order_index,
    )
    db.add(detail)

    # Update mistake tracking
    if is_correct:
        mistake = await db.scalar(
            select(Mistake).where(
                Mistake.user_id == user_id,
                Mistake.question_id == question_id,
            )
        )
        if mistake and not mistake.is_mastered:
            mistake.consecutive_correct += 1
            if mistake.consecutive_correct >= 3:
                mistake.is_mastered = True
    else:
        mistake = await db.scalar(
            select(Mistake).where(
                Mistake.user_id == user_id,
                Mistake.question_id == question_id,
            )
        )
        if mistake:
            mistake.wrong_count += 1
            mistake.last_wrong_at = datetime.utcnow()
            mistake.consecutive_correct = 0
            mistake.is_mastered = False
        else:
            mistake = Mistake(
                user_id=user_id,
                question_id=question_id,
                wrong_count=1,
                last_wrong_at=datetime.utcnow(),
                consecutive_correct=0,
                is_mastered=False,
            )
            db.add(mistake)

    await db.flush()

    # Convert correct answer to array format for frontend
    qtype = question.type.value if hasattr(question.type, "value") else str(question.type)
    if qtype == "MULTIPLE":
        correct_answers = list(question.answer)
    elif qtype == "TRUE_FALSE":
        # Map answer text back to letter labels for frontend display
        # e.g., "正确" -> ["A"], "错误" -> ["B"]
        options = question.options or []
        if question.answer in options:
            idx = options.index(question.answer)
            correct_answers = [chr(ord("A") + idx)]
        else:
            correct_answers = [question.answer]
    else:
        correct_answers = [question.answer]

    return {
        "is_correct": is_correct,
        "correct_answers": correct_answers,
        "analysis": question.explanation,
    }


async def finish_practice(
    db: AsyncSession,
    session_id: str,
    time_spent: int,
    user_id: str,
) -> dict:
    # Verify session
    session = await db.scalar(
        select(PracticeSession).where(
            PracticeSession.id == session_id,
            PracticeSession.user_id == user_id,
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.is_completed:
        raise HTTPException(status_code=400, detail="Session already completed")

    # Count correct answers
    correct_count = await db.scalar(
        select(func.count(PracticeDetail.id)).where(
            PracticeDetail.session_id == session_id,
            PracticeDetail.is_correct == True,  # noqa: E712
        )
    )
    correct_count = correct_count or 0

    # Update session
    session.correct_count = correct_count
    session.time_spent = time_spent
    session.is_completed = True
    session.finished_at = datetime.utcnow()

    # Upsert learning log for today
    today = date.today()
    log = await db.scalar(
        select(LearningLog).where(
            LearningLog.user_id == user_id,
            LearningLog.date == today,
        )
    )
    if log:
        log.count += session.total_count
        log.correct += correct_count
    else:
        log = LearningLog(
            user_id=user_id,
            date=today,
            count=session.total_count,
            correct=correct_count,
        )
        db.add(log)

    # Fetch all details for response
    details_result = await db.execute(
        select(PracticeDetail, Question)
        .join(Question, PracticeDetail.question_id == Question.id)
        .where(PracticeDetail.session_id == session_id)
        .order_by(PracticeDetail.order_index)
    )
    rows = details_result.all()

    details = []
    for detail, question in rows:
        details.append({
            "stem": question.content,
            "user_answer": detail.user_answer,
            "correct_answer": question.answer,
            "is_correct": detail.is_correct,
            "time_spent": detail.time_spent,
        })

    accuracy = round(correct_count / session.total_count * 100, 1) if session.total_count > 0 else 0.0

    await db.flush()

    return {
        "session_id": session.id,
        "total_count": session.total_count,
        "correct_count": correct_count,
        "accuracy": accuracy,
        "time_spent": time_spent,
        "details": details,
    }
