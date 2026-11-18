from decimal import Decimal

from sqlalchemy import Numeric
from sqlmodel import Field, SQLModel


class Service(SQLModel, table=True):
    """Un servicio que vende la empresa. No tiene stock propio ni costo guardado: los dos salen de su ficha."""

    __tablename__ = "servicios"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    codigo: str = Field(max_length=50)  # S-0001, lo genera el servicio; unico por empresa
    nombre: str = Field(max_length=150)
    precio_venta: Decimal = Field(sa_type=Numeric(14, 2), default=0)
    impuesto_id: int = Field(foreign_key="impuestos.id")
    activo: bool = Field(default=True)


class TechnicalSheetLine(SQLModel, table=True):
    """Una linea de la receta: cuanto de un insumo consume UNA unidad del servicio."""

    __tablename__ = "fichas_tecnicas"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    servicio_id: int = Field(foreign_key="servicios.id")
    item_id: int = Field(foreign_key="items.id")  # solo items con es_insumo verdadero
    cantidad: Decimal = Field(sa_type=Numeric(14, 4))
