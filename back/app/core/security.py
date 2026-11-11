from authx import AuthX, AuthXConfig
from pwdlib import PasswordHash

from app.core.config import settings

auth_config = AuthXConfig(
    JWT_SECRET_KEY=settings.JWT_SECRET_KEY,
    JWT_TOKEN_LOCATION=["cookies"],
    JWT_COOKIE_HTTP_ONLY=True,
    JWT_COOKIE_SECURE=settings.ENVIRONMENT != "local",  # False solo en local (sin HTTPS)
    JWT_COOKIE_SAMESITE="lax",
    JWT_COOKIE_CSRF_PROTECT=True,  # nunca se apaga
)

auth = AuthX(config=auth_config)

# Argon2 con los parametros recomendados por la libreria
password_hash = PasswordHash.recommended()
