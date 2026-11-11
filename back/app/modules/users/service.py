from sqlmodel import Session, select

from app.core.errors import AlreadyExistsError
from app.core.security import password_hash
from app.modules.companies.models import Company
from app.modules.users.models import User, UserCompany


def create_company_with_owner(
    session: Session, company_name: str, owner_name: str, email: str, password: str
) -> None:
    """Crea la empresa y su usuario propietario. Lo usa el comando de consola."""
    if session.exec(select(User).where(User.email == email)).first():
        raise AlreadyExistsError("Usuario", "email", email)

    company = Company(nombre=company_name)
    user = User(nombre=owner_name, email=email, password_hash=password_hash.hash(password))
    session.add(company)
    session.add(user)
    session.flush()

    session.add(UserCompany(usuario_id=user.id, empresa_id=company.id, rol="propietario"))
    session.commit()


def get_active_user(session: Session, user_id: int) -> User | None:
    """Unico lugar que define que es un "usuario activo": lo usan el login,
    el subject getter de AuthX y el refresh, para no repetir el chequeo.
    """
    user = session.get(User, user_id)
    return user if user and user.activo else None
