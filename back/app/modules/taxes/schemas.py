from decimal import Decimal

from sqlmodel import SQLModel


class TaxRead(SQLModel):
    id: int
    nombre: str
    porcentaje: Decimal
    activo: bool
