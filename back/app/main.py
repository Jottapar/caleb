from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router as v1_router
from app.core.config import settings
from app.core.errors import AppError
from app.core.handlers import app_error_handler, unexpected_error_handler
from app.core.logger import logger

app = FastAPI(title="Caleb API", version="0.1.0")

# El navegador bloquea las peticiones del front (otro puerto) si el backend
# no declara que ese origen es valido. allow_credentials es obligatorio para
# que viaje la cookie de sesion que emitira AuthX en la historia #1.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],)
# Solo dos handlers: los errores de dominio y todo lo demas.
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unexpected_error_handler)

app.include_router(v1_router)

logger.info(f"Caleb API iniciada | entorno={settings.ENVIRONMENT}")
