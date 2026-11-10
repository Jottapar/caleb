from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel

from app.core.mixins import utc_now


class Company(SQLModel, table=True):
    """Una empresa del MVP. Un usuario pertenece a una sola (ver UserCompany)."""

    __tablename__ = "empresas"

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=150)
    documento_fiscal: str = Field(max_length=30, default="")
    pais: str = Field(max_length=2, default="CO")
    moneda: str = Field(max_length=3, default="COP")
    activa: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now, sa_type=DateTime(timezone=True))
