from decimal import Decimal

from sqlmodel import SQLModel


class SheetItemLineCreate(SQLModel):
    item_id: int
    cantidad: Decimal


class SheetServiceLineCreate(SQLModel):
    servicio_id: int
    cantidad: Decimal = Decimal(1)


class TechnicalSheetCreate(SQLModel):
    nombre: str
    impuesto_id: int
    precio_venta: Decimal = Decimal(0)
    # Una ficha necesita al menos una linea, de insumo o de servicio (lo valida el servicio)
    insumos: list[SheetItemLineCreate] = []
    servicios: list[SheetServiceLineCreate] = []


class TechnicalSheetActiveUpdate(SQLModel):
    activo: bool


class SheetItemLineRead(SQLModel):
    item_id: int
    codigo: str
    nombre: str
    cantidad: Decimal
    costo_unitario: Decimal  # el costo actual del insumo, no una copia


class SheetServiceLineRead(SQLModel):
    servicio_id: int
    codigo: str
    nombre: str
    cantidad: Decimal
    costo_unitario: Decimal  # el costo actual del servicio, no una copia


class TechnicalSheetRead(SQLModel):
    id: int
    codigo: str
    nombre: str
    precio_venta: Decimal
    impuesto_id: int
    activo: bool
    costo: Decimal  # calculado: suma de (costo x cantidad) de insumos y servicios
    insumos: list[SheetItemLineRead]
    servicios: list[SheetServiceLineRead]
