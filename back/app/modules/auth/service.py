from sqlmodel import Session, select

from app.core.errors import UnauthorizedError
from app.core.security import password_hash
from app.modules.companies.models import Company
from app.modules.users import service as users_service
from app.modules.users.models import User, UserCompany

# Mismo mensaje sin importar cual de los dos fallo: no revela que correos existen.
CREDENCIALES_INVALIDAS = "Correo o contraseña incorrectos"


def authenticate(session: Session, email: str, password: str) -> User:
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not user.activo or not password_hash.verify(password, user.password_hash):
        raise UnauthorizedError(CREDENCIALES_INVALIDAS)
    return user


def get_active_user(session: Session, user_id: int) -> User:
    """Lo usa el refresh: si el usuario se desactivo o se borro, no renueva el token."""
    user = users_service.get_active_user(session, user_id)
    if not user:
        raise UnauthorizedError(CREDENCIALES_INVALIDAS)
    return user


def get_company_name(session: Session, user_id: int) -> str:
    """El MVP es un usuario = una empresa, por eso basta con la primera fila."""
    company = session.exec(
        select(Company)
        .join(UserCompany, UserCompany.empresa_id == Company.id)
        .where(UserCompany.usuario_id == user_id)
    ).first()
    return company.nombre if company else ""
