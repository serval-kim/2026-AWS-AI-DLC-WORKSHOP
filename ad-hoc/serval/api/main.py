"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from shared.logging import setup_logging, get_logger
from api.routes import router

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    logger.info("api_server_starting")
    yield
    logger.info("api_server_stopping")


app = FastAPI(
    title="Accident Analysis API",
    description="블랙박스 영상 AI 사고 분석 및 과실비율 판단 시스템",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global error handler - never expose internal details (SECURITY-09, SECURITY-15)."""
    logger.error("unhandled_exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": "An unexpected error occurred"},
    )


if __name__ == "__main__":
    import uvicorn
    from shared.config import settings

    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
