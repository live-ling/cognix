from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.auth import router as auth_router
from app.api.banks import router as banks_router
from app.api.questions import router as questions_router
from app.api.practice import router as practice_router
from app.api.mistakes import router as mistakes_router
from app.api.stats import router as stats_router
from app.api.import_router import router as import_router


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
    app.include_router(banks_router, prefix="/api/banks", tags=["Banks"])
    app.include_router(
        questions_router,
        prefix="/api/banks/{bank_id}/questions",
        tags=["Questions"],
    )
    app.include_router(practice_router, prefix="/api/practice", tags=["Practice"])
    app.include_router(mistakes_router, prefix="/api/mistakes", tags=["Mistakes"])
    app.include_router(stats_router, prefix="/api/stats", tags=["Stats"])
    app.include_router(import_router, prefix="/api/import", tags=["Import"])

    @app.get("/api/health")
    async def health_check():
        return {"status": "ok", "version": settings.APP_VERSION}

    return app


app = create_app()
