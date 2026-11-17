from sqlalchemy import func
from sqlmodel import Session, select

from app.core.errors import AlreadyExistsError, NotFoundError
from app.core.security import password_hash
from app.modules.companies.models import Company
from app.modules.taxes import service as taxes_service
from app.modules.users.models import User, UserCompany


def normalize_email(email: str) -> str:
    """El correo sin espacios alrededor y en minusculas: `Juan@Gmail.com ` -> `juan@gmail.com`."""
    return email.strip().lower()


def get_user_by_email(session: Session, email: str) -> User | None:
    """Busca un usuario por correo sin importar mayusculas, o None.

    Compara lower() de la columna, no solo el correo normalizado: asi tambien
    encuentra a los usuarios que se guardaron con mayusculas antes de esta regla.
    """
    return session.exec(
        select(User).where(func.lower(User.email) == normalize_email(email))
    ).first()


def create_company_with_owner(
    session: Session, company_name: str, owner_name: str, email: str, password: str
) -> None:
    """Crea la empresa, su usuario propietario y sus catalogos por defecto. Lo usa el comando de consola."""
    email = normalize_email(email)
    if get_user_by_email(session, email):
        raise AlreadyExistsError("Usuario", "email", email)

    company = Company(nombre=company_name)
    user = User(nombre=owner_name, email=email, password_hash=password_hash.hash(password))
    session.add(company)
    session.add(user)
    session.flush()

    session.add(UserCompany(usuario_id=user.id, empresa_id=company.id, rol="propietario"))
    taxes_service.seed_default_taxes(session, company.id)
    session.commit()


def reset_password(session: Session, email: str, new_password: str) -> None:
    """Le pone una password nueva a un usuario. Lo usa el comando de consola."""
    user = get_user_by_email(session, email)
    if not user:
        raise NotFoundError("Usuario", email)

    user.password_hash = password_hash.hash(new_password)
    session.add(user)
    session.commit()


def get_company_id(session: Session, user_id: int) -> int:
    """La empresa del usuario. El MVP es un usuario = una empresa, por eso basta la primera fila."""
    user_company = session.exec(
        select(UserCompany).where(UserCompany.usuario_id == user_id)
    ).first()
    return user_company.empresa_id


def get_active_user(session: Session, user_id: int) -> User | None:
    """Busca por id un usuario que siga activo, o None.

    Unico lugar que define eso para las peticiones ya autenticadas: lo usan el
    subject getter de AuthX y el refresh. El login no lo usa porque busca por
    correo, no por id.
    """
    user = session.get(User, user_id)
    return user if user and user.activo else None
