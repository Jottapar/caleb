"""Auditoria automatica: fechas y autor de las filas que se guardan.

Un evento de SQLAlchemy corre justo antes de cada `flush` y llena las columnas de auditoria,
asi ningun servicio tiene que repetirlo.
"""

from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlmodel import select

from app.core.mixins import AuditMixin, DatesMixin, utc_now
from app.modules.users.models import User

# Caleb es el sistema: el autor de lo que no tiene una persona detras (consola, migraciones).
# Se identifica por su correo y no por un id, porque el id cambia de una base a otra.
SYSTEM_USER_EMAIL = "caleb@caleb.com"
# Clave de `session.info` donde la peticion deja el id de su usuario (la pone `get_current_user`).
ACTOR_KEY = "actor_id"
# Clave de `session.info` donde se guarda el id de Caleb tras buscarlo, para no repetir la consulta.
SYSTEM_USER_KEY = "system_user_id"


def _author_id(session: Session) -> int:
    """El usuario de la peticion si la sesion lo trae; si no (consola, migraciones), Caleb."""
    actor_id = session.info.get(ACTOR_KEY)
    if actor_id is not None:
        return actor_id
    if SYSTEM_USER_KEY not in session.info:
        session.info[SYSTEM_USER_KEY] = session.execute(
            select(User.id).where(User.email == SYSTEM_USER_EMAIL)
        ).scalar_one()
    return session.info[SYSTEM_USER_KEY]


@event.listens_for(Session, "before_flush")
def fill_audit(session, flush_context, instances):
    """Llena la auditoria de las filas nuevas y de las que cambiaron, antes de guardarlas."""
    for row in session.new:
        if isinstance(row, DatesMixin):
            # Al crear, la edicion es igual a la creacion (si no, diferirian por microsegundos).
            row.updated_at = row.created_at
        if isinstance(row, AuditMixin):
            row.created_by_id = row.updated_by_id = _author_id(session)

    for row in session.dirty:
        # `dirty` incluye filas a las que se les asigno el mismo valor: `is_modified` filtra
        # las que cambiaron de verdad.
        if isinstance(row, DatesMixin) and session.is_modified(row):
            row.updated_at = utc_now()
            if isinstance(row, AuditMixin):
                row.updated_by_id = _author_id(session)
