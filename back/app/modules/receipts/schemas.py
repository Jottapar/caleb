from datetime import date
from decimal import Decimal

from sqlmodel import SQLModel


class ReceiptItemLineCreate(SQLModel):
    item_id: int
    cantidad: Decimal


class ReceiptCreate(SQLModel):
    tercero_id: int
    lineas: list[ReceiptItemLineCreate]
    notas: str = ""


class ReceiptItemLineRead(SQLModel):
    id: int
    item_id: int
    descripcion: str
    cantidad: Decimal
    precio_unitario: Decimal
    impuesto_porcentaje: Decimal
    total_linea: Decimal


class ReceiptRead(SQLModel):
    id: int
    tercero_id: int
    numero: str
    fecha: date
    condicion: str
    fecha_vencimiento: date
    estado: str
    subtotal: Decimal
    impuestos_total: Decimal
    total: Decimal
    notas: str
    lineas: list[ReceiptItemLineRead]
