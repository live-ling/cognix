"""Seed script: populate the database with demo data for development.

Usage:
    python -m seed.seed_data

Requires MySQL to be running and DATABASE_URL in .env to be configured.
Tables must already exist (run alembic upgrade head first).
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import asyncio
import random
import uuid
from datetime import datetime, timedelta, date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings
from app.database import Base
from app.models.user import User
from app.models.bank import Bank
from app.models.question import Question
from app.models.practice import PracticeSession, PracticeDetail
from app.models.mistake import Mistake
from app.models.learning_log import LearningLog
from app.utils.auth import hash_password
from seed.seed_questions import JS_QUESTIONS, ALGO_QUESTIONS, NETWORK_QUESTIONS


BANK_DATA = [
    {
        "title": "JavaScript基础",
        "description": "JavaScript核心语法、数据类型、作用域、闭包等基础知识",
        "color": "#f0db4f",
    },
    {
        "title": "算法与数据结构",
        "description": "常见算法题、排序、搜索、树、图等数据结构",
        "color": "#61dafb",
    },
    {
        "title": "计算机网络",
        "description": "TCP/IP、HTTP、DNS、网络安全等网络基础知识",
        "color": "#764abc",
    },
]

QUESTION_SETS = [JS_QUESTIONS, ALGO_QUESTIONS, NETWORK_QUESTIONS]


async def ensure_schema(engine):
    """Ensure the database schema is up to date (add missing columns)."""
    async with engine.begin() as conn:
        # Add missing columns to user table
        columns_to_add = [
            ("password_hash", "VARCHAR(255) NULL"),
            ("bio", "VARCHAR(500) NULL DEFAULT ''"),
            ("ai_api_key", "VARCHAR(255) NULL DEFAULT ''"),
            ("ai_base_url", "VARCHAR(500) NULL DEFAULT ''"),
            ("ai_model", "VARCHAR(100) NULL DEFAULT ''"),
        ]
        for col_name, col_def in columns_to_add:
            result = await conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = 'user' "
                f"AND COLUMN_NAME = '{col_name}'"
            ))
            if result.scalar() == 0:
                await conn.execute(text(f"ALTER TABLE user ADD COLUMN {col_name} {col_def}"))
                print(f"  🔧 添加 {col_name} 列到 user 表")


async def clear_data(engine):
    """Clear all existing data (respects FK order)."""
    async with engine.begin() as conn:
        tables = [
            "learning_log", "mistake", "practice_detail",
            "practice_session", "exam_detail", "exam_session",
            "question", "bank", "user",
        ]
        for t in tables:
            await conn.execute(text(f"DELETE FROM {t}"))
        print("  🗑️  已清空所有数据表")


async def seed():
    """Main seed function."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    # Auto-migrate schema before seeding
    await ensure_schema(engine)

    # Clear existing data
    await clear_data(engine)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("🌱 开始填充种子数据...")

        # 1. Create default user (with password)
        default_password = hash_password("admin123")
        user = User(
            id="default",
            name="liveling",
            email="1149356389@qq.com",
            password_hash=default_password,
        )
        db.add(user)
        await db.flush()
        print("  ✅ 创建默认用户 (default@liveling.cn / admin123)")

        # 2. Create banks
        banks = []
        for data in BANK_DATA:
            bank = Bank(
                id=str(uuid.uuid4()),
                user_id=user.id,
                title=data["title"],
                description=data["description"],
                color=data["color"],
            )
            db.add(bank)
            banks.append(bank)
        await db.flush()
        print("  ✅ 创建 3 个题库")

        # 3. Create questions (20 per bank)
        all_questions = []
        for bank_idx, bank in enumerate(banks):
            templates = QUESTION_SETS[bank_idx]
            for j in range(20):
                template = templates[j % len(templates)]
                q = Question(
                    id=str(uuid.uuid4()),
                    bank_id=bank.id,
                    type=template["type"],
                    content=template["content"],
                    options=template["options"],
                    answer=template["answer"],
                    explanation=template["explanation"],
                    difficulty=template["difficulty"],
                    tags=template["tags"],
                )
                db.add(q)
                all_questions.append(q)
        await db.flush()
        print(f"  ✅ 创建 60 道题目（3×20）")

        # 4. Create practice records (last 30 days)
        modes = ["sequential", "random"]
        session_count = 0
        for day_offset in range(30, -1, -1):
            sessions_per_day = 2 if random.random() > 0.3 else 1
            for _ in range(sessions_per_day):
                bank = random.choice(banks)
                total_count = random.choice([10, 15, 20, 20, 25])
                correct_count = int(total_count * (0.6 + random.random() * 0.35))
                mode = random.choice(modes)
                time_spent = total_count * (8 + random.randint(0, 25))

                started_at = datetime.utcnow() - timedelta(days=day_offset)
                started_at = started_at.replace(
                    hour=9 + random.randint(0, 12),
                    minute=random.randint(0, 59),
                )

                session = PracticeSession(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    bank_id=bank.id,
                    mode=mode,
                    total_count=total_count,
                    correct_count=correct_count,
                    time_spent=time_spent,
                    is_completed=True,
                    started_at=started_at,
                    finished_at=started_at + timedelta(seconds=time_spent),
                )
                db.add(session)
                await db.flush()

                # Create details
                bank_questions = [q for q in all_questions if q.bank_id == bank.id]
                sampled = random.sample(
                    bank_questions,
                    min(total_count, len(bank_questions)),
                )
                for idx, question in enumerate(sampled):
                    is_correct = idx < correct_count
                    detail = PracticeDetail(
                        id=str(uuid.uuid4()),
                        session_id=session.id,
                        question_id=question.id,
                        user_answer="C" if is_correct else "B",
                        is_correct=is_correct,
                        time_spent=5 + random.randint(0, 30),
                        order_index=idx,
                    )
                    db.add(detail)
                session_count += 1
        print(f"  ✅ 创建 {session_count} 个练习会话")

        # 5. Create mistakes (15 records)
        mistake_configs = [
            (3, 3, 0, False), (7, 2, 2, False), (12, 4, 3, True),
            (15, 1, 0, False), (21, 3, 1, False), (28, 2, 0, False),
            (33, 1, 1, False), (39, 5, 3, True), (42, 2, 0, False),
            (48, 1, 0, False), (51, 3, 2, False), (55, 2, 0, False),
            (58, 1, 0, False), (5, 4, 0, False), (18, 1, 3, True),
        ]
        mistake_count = 0
        for q_idx, wrong_count, consecutive_correct, is_mastered in mistake_configs:
            if q_idx <= len(all_questions):
                mistake = Mistake(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    question_id=all_questions[q_idx - 1].id,
                    wrong_count=wrong_count,
                    consecutive_correct=consecutive_correct,
                    is_mastered=is_mastered,
                    last_wrong_at=datetime.utcnow() - timedelta(days=random.randint(0, 14)),
                )
                db.add(mistake)
                mistake_count += 1
        print(f"  ✅ 创建 {mistake_count} 条模拟错题")

        # 6. Create learning logs (last 60 days)
        log_count = 0
        for day_offset in range(60, -1, -1):
            if random.random() > 0.2:
                log_date = date.today() - timedelta(days=day_offset)
                count = 10 + random.randint(0, 40)
                correct = int(count * (0.6 + random.random() * 0.3))
                log_entry = LearningLog(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    date=log_date,
                    count=count,
                    correct=correct,
                )
                db.add(log_entry)
                log_count += 1
        print(f"  ✅ 创建 {log_count} 天学习日志")

        await db.commit()
        print("🎉 种子数据填充完成！")
        print("   账号: 1149356389@qq.com")
        print("   密码: admin123")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
