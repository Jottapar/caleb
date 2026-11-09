import sys

from loguru import logger

from app.core.config import settings

# Se quita el handler por defecto para no duplicar cada linea
logger.remove()

logger.add(
    sys.stderr,
    level="DEBUG" if settings.ENVIRONMENT == "local" else "INFO",
    backtrace=settings.ENVIRONMENT == "local",
    # diagnose imprime el valor de las variables locales en un traceback.
    # Siempre False: en un error de login escribiria la contrasena en el log.
    diagnose=False,
)

__all__ = ["logger"]
