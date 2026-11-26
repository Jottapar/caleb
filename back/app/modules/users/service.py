import unicodedata

from sqlalchemy import func
from psycopg.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, select

from app.core.errors import AlreadyExistsError, BusinessError, NotFoundError
from app.core.security import password_hash
from app.core.validators import FORMATO_CORREO
from app.modules.companies.models import Company
from app.modules.taxes import service as taxes_service
from app.modules.users.models import User, UserCompany
from app.modules.users.schemas import UserCreate, UserListRead, UserRead, UserUpdate


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


def _validate_user_fields(nombre: str, email: str, rol: str) -> None:
    """Rechaza con BusinessError (422) un nombre, correo o rol que no sirve. Ya vienen limpios.

    Lo comparten crear y editar un usuario.
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


def _validate_password_length(password: str) -> None:
    """Rechaza con BusinessError (422) una contraseña de menos de 8 caracteres. Lo comparten crear y cambiarla."""
    if len(password) < MIN_LARGO_PASSWORD:
        raise BusinessError(f"La contraseña debe tener al menos {MIN_LARGO_PASSWORD} caracteres")


def _validate_new_user(nombre: str, email: str, rol: str, password: str) -> None:
    """Las validaciones de crear: las de los datos y la de la contraseña inicial.

    La contraseña no se limpia: los espacios de los lados cuentan como parte de ella.
    """
    _validate_user_fields(nombre, email, rol)
    _validate_password_length(password)


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
    except IntegrityError as error:
        # La busqueda de arriba no alcanza: dos peticiones simultaneas con el mismo correo pueden
        # pasarla las dos, y quien frena a la segunda es la restriccion `unique` de la base.
        # Se deshace para dejar la sesion limpia. Solo se atrapa el duplicado (codigo 23505 de
        # Postgres): cualquier otro rechazo es un error real y se deja subir.
        session.rollback()
        if not isinstance(error.orig, UniqueViolation):
            raise
        raise AlreadyExistsError("Usuario", "email", email)

    session.add(UserCompany(usuario_id=user.id, empresa_id=empresa_id, rol=data.rol))
    session.commit()
    return UserRead(
        id=user.id, nombre=user.nombre, email=user.email, rol=data.rol, activo=user.activo
    )


def _name_sort_key(nombre: str) -> str:
    """La clave para ordenar nombres alfabéticamente: sin mayúsculas ni tildes, con la Ñ después de la N.

    `Álvaro` -> `alvaro`, `Ñandú` -> `n{andu`. La Ñ se vuelve «n» + «{» (el carácter que va justo
    después de la «z»), así queda entre «nz…» y «o…», como en el abecedario español.
    """
    clave = ""
    for letra in nombre.casefold():
        if letra == "ñ":
            clave += "n{"
        else:
            # NFD separa la letra de su tilde (á -> a + ´) y se descartan las tildes sueltas.
            clave += "".join(
                c for c in unicodedata.normalize("NFD", letra) if not unicodedata.combining(c)
            )
    return clave


def _ids_with_history(session: Session) -> set[int]:
    """Los ids de los usuarios que figuran como autor en alguna tabla con auditoría."""
    ids: set[int] = set()
    # Se recorren las tablas registradas y se toman las que tienen autor: una tabla nueva con
    # `AuditMixin` cuenta sola, sin que nadie la agregue a una lista.
    for table in SQLModel.metadata.tables.values():
        if "created_by_id" in table.c:
            for author in (table.c.created_by_id, table.c.updated_by_id):
                ids.update(session.exec(select(author).distinct()).all())
    return ids


def list_users(session: Session, empresa_id: int) -> list[UserListRead]:
    """Todos los usuarios de la empresa `empresa_id`, activos e inactivos, con su rol en ella.

    El rol sale de `usuarios_empresas`, filtrado por la empresa. Nunca incluye el hash.
    """
    rows = session.exec(
        select(User, UserCompany.rol)
        .join(UserCompany, UserCompany.usuario_id == User.id)
        .where(UserCompany.empresa_id == empresa_id)
    ).all()
    # El orden se hace aquí y no con ORDER BY: en SQL lo decide la collation de la base, que
    # cambia de un Postgres a otro (en Neon, «C.UTF-8», las tildes y mayúsculas quedan mal).
    rows = sorted(rows, key=lambda row: (_name_sort_key(row[0].nombre), row[0].id))
    con_historial = _ids_with_history(session)
    return [
        UserListRead(
            id=user.id,
            nombre=user.nombre,
            email=user.email,
            rol=rol,
            activo=user.activo,
            tiene_historial=user.id in con_historial,
        )
        for user, rol in rows
    ]


def _count_other_admins(session: Session, empresa_id: int, user_id: int) -> int:
    """Cuántos usuarios con rol admin y activos tiene la empresa, sin contar a `user_id`.

    Un Admin desactivado no cuenta: no puede entrar, así que no sirve para administrar.
    """
    return session.exec(
        select(func.count())
        .select_from(UserCompany)
        .join(User, User.id == UserCompany.usuario_id)
        .where(
            User.activo,
            UserCompany.empresa_id == empresa_id,
            UserCompany.rol == "admin",
            UserCompany.usuario_id != user_id,
        )
    ).one()


def update_user(session: Session, empresa_id: int, user_id: int, data: UserUpdate) -> UserRead:
    """Edita nombre, correo, rol y estado de un usuario de la empresa `empresa_id` y devuelve sus datos.

    Busca al usuario por su fila en `usuarios_empresas`, así solo encuentra a los de esa empresa.
    """
    row = session.exec(
        select(User, UserCompany)
        .join(UserCompany, UserCompany.usuario_id == User.id)
        .where(User.id == user_id, UserCompany.empresa_id == empresa_id)
    ).first()
    if not row:
        # Un usuario de otra empresa responde igual que uno que no existe: no se revela que existe.
        raise NotFoundError("Usuario", user_id)
    user, link = row

    # Se valida el estado final: lo que llega mezclado con lo que el usuario ya tenía.
    nombre = data.nombre.strip() if data.nombre is not None else user.nombre
    email = normalize_email(data.email) if data.email is not None else user.email
    rol = data.rol if data.rol is not None else link.rol
    _validate_user_fields(nombre, email, rol)
    activo = data.activo if data.activo is not None else user.activo
    # Solo frena el cambio que le quita a este usuario su condición de Admin activo (por el rol
    # o por desactivarlo) cuando no queda otro. Editar a quien no es Admin activo no lo toca.
    era_admin_activo = link.rol == "admin" and user.activo
    seguira_siendo = rol == "admin" and activo
    if era_admin_activo and not seguira_siendo and _count_other_admins(session, empresa_id, user.id) == 0:
        raise BusinessError("La empresa debe tener al menos un Admin activo")
    # Repetido solo si lo tiene OTRO usuario: dejar el suyo (aunque cambien las mayúsculas) no es error.
    existing = get_user_by_email(session, email)
    if existing and existing.id != user.id:
        raise AlreadyExistsError("Usuario", "email", email)

    user.nombre = nombre
    user.email = email
    link.rol = rol
    # Desactivar solo cambia este dato: el login y la sesión ya rechazan a un usuario inactivo.
    user.activo = activo
    try:
        session.commit()
    except IntegrityError as error:
        # La búsqueda de arriba no alcanza: dos peticiones simultáneas con el mismo correo pueden
        # pasarla las dos, y quien frena a la segunda es la restricción `unique` de la base.
        # Solo se atrapa el duplicado (código 23505 de Postgres): cualquier otro rechazo es un
        # error real y se deja subir.
        session.rollback()
        if not isinstance(error.orig, UniqueViolation):
            raise
        raise AlreadyExistsError("Usuario", "email", email)
    return UserRead(
        id=user.id, nombre=user.nombre, email=user.email, rol=link.rol, activo=user.activo
    )


def delete_user(session: Session, empresa_id: int, user_id: int) -> None:
    """Elimina de verdad a un usuario de la empresa `empresa_id`: su vínculo y su fila.

    Borra primero el vínculo en `usuarios_empresas`, que apunta al usuario por llave foránea.
    """
    row = session.exec(
        select(User, UserCompany)
        .join(UserCompany, UserCompany.usuario_id == User.id)
        .where(User.id == user_id, UserCompany.empresa_id == empresa_id)
    ).first()
    if not row:
        raise NotFoundError("Usuario", user_id)
    user, link = row
    if user.activo:
        raise BusinessError("Primero desactiva al usuario para poder eliminarlo")
    if user.id in _ids_with_history(session):
        raise BusinessError("No se puede eliminar a un usuario con historial; solo desactivarlo")

    session.delete(link)
    session.flush()  # el vínculo sale antes que el usuario
    session.delete(user)
    session.commit()


def change_password(session: Session, user_id: int, current_password: str, new_password: str) -> None:
    """Cambia la contraseña del usuario `user_id` (quien hace la petición) por `new_password`.

    Recibe el id y no el objeto: el `User` de la sesión de autenticación vive en otra sesión de
    base de datos, y cambiarlo ahí no se guardaría con el `commit` de esta.
    """
    user = session.get(User, user_id)
    if not password_hash.verify(current_password, user.password_hash):
        raise BusinessError("La contraseña actual no es correcta")
    _validate_password_length(new_password)
    if new_password == current_password:
        raise BusinessError("La contraseña nueva debe ser distinta de la actual")
    user.password_hash = password_hash.hash(new_password)
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
