from decimal import Decimal

from sqlalchemy import Numeric
from sqlmodel import Field

from app.core.mixins import AuditMixin


class Service(AuditMixin, table=True):
    """Mano de obra de una empresa. Solo tiene costo: no se vende sola ni mueve inventario."""

    __tablename__ = "servicios"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    codigo: str = Field(max_length=50)  # S-0001, lo genera el servicio; unico por empresa
    nombre: str = Field(max_length=150)
    costo: Decimal = Field(sa_type=Numeric(14, 2), default=0)
    activo: bool = Field(default=True)
