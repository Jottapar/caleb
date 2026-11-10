from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel

from app.core.mixins import utc_now


class User(SQLModel, table=True):
    """Una persona que entra al sistema. `password_hash` nunca guarda texto plano."""

    __tablename__ = "usuarios"

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=150)
    email: str = Field(max_length=150, unique=True)
    password_hash: str = Field(max_length=255)
    activo: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now, sa_type=DateTime(timezone=True))


class UserCompany(SQLModel, table=True):
    """El rol de un usuario dentro de una empresa.

    En el MVP un usuario esta en una sola empresa, pero la tabla ya soporta
    varias para no tener que migrar cuando eso cambie en V2.
    """

    __tablename__ = "usuarios_empresas"

    id: int | None = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id")
    empresa_id: int = Field(foreign_key="empresas.id")
    # Valores validos (los valida el backend, sin enum): propietario, administrador, contador, vendedor
    rol: str = Field(max_length=20, default="vendedor")
