from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router
from app.modules.third_parties.router import router as third_parties_router

# Unico lugar donde se arma la version 1 de la API. Cada modulo nuevo
# se incluye aqui y en ningun otro sitio.
router = APIRouter(prefix="/api/v1")

router.include_router(health_router)
router.include_router(auth_router)
router.include_router(third_parties_router)
