from fastapi import APIRouter, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionDep
from app.core.logger import logger

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def check_health(session: SessionDep, response: Response):
    """Comprueba que la API responde y que la base de datos contesta.

    Un health check que solo dice "la API esta viva" no sirve para desplegar:
    la app puede estar levantada y la base caida. Por eso hace un SELECT 1.
    """
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Health check: la base de datos no responde")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "error", "database": "error", "environment": settings.ENVIRONMENT}

    return {"status": "ok", "database": "ok", "environment": settings.ENVIRONMENT}
