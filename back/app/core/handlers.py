from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.errors import AppError
from app.core.logger import logger


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Traduce un error de dominio a una respuesta HTTP."""
    logger.warning(f"{exc.code.upper()} | {exc.message} | {request.method} {request.url}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "message": exc.message},
    )


async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Ultima red de seguridad: registra el error completo y responde 500.

    El usuario nunca ve el detalle interno; el traceback queda en los logs.
    """
    logger.exception(f"ERROR INESPERADO | {request.method} {request.url}")
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "Error interno del servidor"},
    )
