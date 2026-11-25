from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    """Hora actual con zona horaria UTC.

    `datetime.now()` sin zona guarda una hora "naive" que depende del
    servidor donde corra la app; con `utc_now()` siempre es comparable.
    """
    return datetime.now(timezone.utc)


class DatesMixin(SQLModel):
    """Las dos fechas de auditoria. Las pone `core/audit.py` al guardar; nadie las asigna a mano."""

    created_at: datetime = Field(default_factory=utc_now, sa_type=DateTime(timezone=True))
    updated_at: datetime = Field(default_factory=utc_now, sa_type=DateTime(timezone=True))


class AuditMixin(DatesMixin):
    """Las fechas y el autor de la creacion y de la ultima edicion. Las cuatro son obligatorias.

    El autor tambien lo pone `core/audit.py`: el usuario de la peticion, o Caleb (el sistema)
    si no hay peticion (consola, migraciones).
    """

    created_by_id: int = Field(foreign_key="usuarios.id")
    updated_by_id: int = Field(foreign_key="usuarios.id")
