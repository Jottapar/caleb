from decimal import Decimal

from sqlmodel import SQLModel


class TechnicalSheetLineCreate(SQLModel):
    item_id: int
    cantidad: Decimal


class ServiceCreate(SQLModel):
    nombre: str
    impuesto_id: int
    precio_venta: Decimal = Decimal(0)
    insumos: list[TechnicalSheetLineCreate]


class TechnicalSheetLineRead(SQLModel):
    item_id: int
    codigo: str
    nombre: str
    cantidad: Decimal
    costo_unitario: Decimal  # el costo actual del insumo, no una copia


class ServiceRead(SQLModel):
    id: int
    codigo: str
    nombre: str
    precio_venta: Decimal
    impuesto_id: int
    activo: bool
    costo: Decimal  # calculado: suma de costo del insumo x cantidad de la ficha
    insumos: list[TechnicalSheetLineRead]
