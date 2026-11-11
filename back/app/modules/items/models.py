from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric
from sqlmodel import Field, SQLModel

from app.core.mixins import utc_now


class Item(SQLModel, table=True):
    """Un producto del inventario de una empresa. `se_vende`/`es_insumo` los valida el servicio."""

    __tablename__ = "items"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    codigo: str = Field(max_length=50)
    nombre: str = Field(max_length=150)
    unidad: str = Field(max_length=20, default="und")
    costo: Decimal = Field(sa_type=Numeric(14, 2), default=0)
    precio_venta: Decimal = Field(sa_type=Numeric(14, 2), default=0)
    impuesto_id: int = Field(foreign_key="impuestos.id")
    se_vende: bool = Field(default=True)
    es_insumo: bool = Field(default=False)
    activo: bool = Field(default=True)


class InventoryMovement(SQLModel, table=True):
    """Una entrada o salida de un item. El stock no se guarda: se calcula sumando estas filas."""

    __tablename__ = "movimientos_inventario"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    item_id: int = Field(foreign_key="items.id")
    # Valores validos (los valida el servicio): entrada, salida, ajuste
    tipo: str = Field(max_length=20)
    cantidad: Decimal = Field(sa_type=Numeric(14, 4))
    costo_unitario: Decimal = Field(sa_type=Numeric(14, 2), default=0)
    # Valores validos: compra, recibo, ajuste_manual
    origen: str = Field(max_length=20)
    origen_id: int
    fecha: datetime = Field(default_factory=utc_now, sa_type=DateTime(timezone=True))
    nota: str = Field(max_length=255, default="")
