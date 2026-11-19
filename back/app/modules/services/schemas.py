from decimal import Decimal

from sqlmodel import SQLModel


class ServiceCreate(SQLModel):
    nombre: str
    costo: Decimal = Decimal(0)


class ServiceRead(SQLModel):
    id: int
    codigo: str
    nombre: str
    costo: Decimal
    activo: bool
