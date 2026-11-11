from decimal import Decimal

from sqlmodel import SQLModel


class ItemCreate(SQLModel):
    nombre: str
    impuesto_id: int
    codigo: str | None = None
    unidad: str = "und"
    costo: Decimal = Decimal(0)
    precio_venta: Decimal = Decimal(0)
    se_vende: bool = True
    es_insumo: bool = False
    cantidad_inicial: Decimal = Decimal(0)


class ItemUpdate(SQLModel):
    nombre: str | None = None
    costo: Decimal | None = None
    precio_venta: Decimal | None = None
    impuesto_id: int | None = None


class ItemRead(SQLModel):
    id: int
    codigo: str
    nombre: str
    unidad: str
    costo: Decimal
    precio_venta: Decimal
    impuesto_id: int
    se_vende: bool
    es_insumo: bool
    activo: bool
    existencias: Decimal
