from decimal import Decimal

from sqlalchemy import Numeric
from sqlmodel import Field, SQLModel


class Tax(SQLModel, table=True):
    """Un impuesto de una empresa, por ejemplo 'IVA 19%'."""

    __tablename__ = "impuestos"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    nombre: str = Field(max_length=50)
    porcentaje: Decimal = Field(sa_type=Numeric(5, 2))
    activo: bool = Field(default=True)
