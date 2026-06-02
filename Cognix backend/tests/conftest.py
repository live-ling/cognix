"""Shared test fixtures for Cognix backend tests."""

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import create_app
from app.database import Base
from app.config import settings


# Use a test database — override with TEST_DATABASE_URL env var
TEST_DATABASE_URL = "mysql+aiomysql://root:password@localhost:3306/cognix_test"


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables after tests
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    """Provide a transactional database session for each test."""
    async_session = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False,
    )
    async with async_session() as session:
        async with session.begin():
            yield session
            await session.rollback()  # Rollback any uncommitted changes


@pytest_asyncio.fixture
async def client(test_engine, db_session):
    """Provide an async HTTP test client."""
    app = create_app()

    # Override the get_db dependency to use test session
    from app.api import deps

    async def override_get_db():
        yield db_session

    app.dependency_overrides[deps.get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
