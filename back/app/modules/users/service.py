from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.errors import AlreadyExistsError, BusinessError, NotFoundError
from app.core.security import password_hash
from app.core.validators import FORMATO_CORREO
from app.modules.companies.models import Company
from app.modules.taxes import service as taxes_service
from app.modules.users.models import User, UserCompany
from app.modules.users.schemas import UserCreate, UserRead


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
    """Crea la empresa, su primer usuario (rol admin) y sus catalogos por defecto. Lo usa el comando de consola."""
    email = normalize_email(email)
    if get_user_by_email(session, email):
        raise AlreadyExistsError("Usuario", "email", email)

    company = Company(nombre=company_name)
    user = User(nombre=owner_name, email=email, password_hash=password_hash.hash(password))
    session.add(company)
    session.add(user)
    session.flush()

    session.add(UserCompany(usuario_id=user.id, empresa_id=company.id, rol="admin"))
    taxes_service.seed_default_taxes(session, company.id)
    session.commit()


MIN_LARGO_PASSWORD = 8
# Largo de las columnas `usuarios.nombre` y `usuarios.email`: si uno cambia, el otro tambien.
MAX_LARGO = 150
# Valores validos de `usuarios_empresas.rol` (sin enum: los valida el backend).
ROLES = ("admin", "usuario", "contador")


def _validate_new_user(nombre: str, email: str, rol: str, password: str) -> None:
    """Rechaza con BusinessError (422) los datos que no sirven. `nombre` y `email` ya vienen limpios.

    La contraseña no se limpia: los espacios de los lados cuentan como parte de ella.
    """
    if not nombre:
        raise BusinessError("El nombre es obligatorio")
    if len(nombre) > MAX_LARGO:
        raise BusinessError(f"El nombre no puede tener más de {MAX_LARGO} caracteres")
    if not email:
        raise BusinessError("El correo es obligatorio")
    if len(email) > MAX_LARGO:
        raise BusinessError(f"El correo no puede tener más de {MAX_LARGO} caracteres")
    if not FORMATO_CORREO.fullmatch(email):
        raise BusinessError("El correo no tiene un formato válido")
    if rol not in ROLES:
        raise BusinessError("El rol debe ser Admin, Usuario o Contador")
    if len(password) < MIN_LARGO_PASSWORD:
        raise BusinessError(f"La contraseña debe tener al menos {MIN_LARGO_PASSWORD} caracteres")


def create_user(session: Session, empresa_id: int, data: UserCreate) -> UserRead:
    """Crea un usuario en la empresa `empresa_id` y devuelve sus datos (sin el hash).

    Guarda el usuario y su fila en `usuarios_empresas` en una sola transaccion.
    """
    nombre = data.nombre.strip()
    email = normalize_email(data.email)
    _validate_new_user(nombre, email, data.rol, data.password)
    if get_user_by_email(session, email):
        raise AlreadyExistsError("Usuario", "email", email)

    user = User(
        nombre=nombre,
        email=email,
        password_hash=password_hash.hash(data.password),
    )
    session.add(user)
    try:
        session.flush()  # asigna `user.id` sin confirmar, para usarlo en la fila de abajo
    except IntegrityError:
        # La busqueda de arriba no alcanza: dos peticiones simultaneas con el mismo correo pueden
        # pasarla las dos, y quien frena a la segunda es la restriccion `unique` de la base.
        # Se deshace para dejar la sesion limpia y se responde igual que con la busqueda.
        session.rollback()
        raise AlreadyExistsError("Usuario", "email", email)

    session.add(UserCompany(usuario_id=user.id, empresa_id=empresa_id, rol=data.rol))
    session.commit()
    return UserRead(
        id=user.id, nombre=user.nombre, email=user.email, rol=data.rol, activo=user.activo
    )


def list_users(session: Session, empresa_id: int) -> list[UserRead]:
    """Todos los usuarios de la empresa `empresa_id`, activos e inactivos, con su rol en ella.

    El rol sale de `usuarios_empresas`, filtrado por la empresa. Nunca incluye el hash.
    """
    rows = session.exec(
        select(User, UserCompany.rol)
        .join(UserCompany, UserCompany.usuario_id == User.id)
        .where(UserCompany.empresa_id == empresa_id)
        .order_by(User.nombre)
    ).all()
    return [
        UserRead(id=user.id, nombre=user.nombre, email=user.email, rol=rol, activo=user.activo)
        for user, rol in rows
    ]


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
