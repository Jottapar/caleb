from decimal import Decimal

from sqlalchemy import Numeric
from sqlmodel import Field, SQLModel


class TechnicalSheet(SQLModel, table=True):
    """Lo que se vende: un producto armado con insumos y mano de obra. Su costo no se guarda."""

    __tablename__ = "fichas_tecnicas"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    codigo: str = Field(max_length=50)  # F-0001, lo genera el servicio; unico por empresa
    nombre: str = Field(max_length=150)
    precio_venta: Decimal = Field(sa_type=Numeric(14, 2), default=0)
    impuesto_id: int = Field(foreign_key="impuestos.id")
    activo: bool = Field(default=True)


class TechnicalSheetItemLine(SQLModel, table=True):
    """Un insumo de la ficha: cuanto consume UNA unidad de la ficha."""

    __tablename__ = "fichas_tecnicas_items"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    ficha_tecnica_id: int = Field(foreign_key="fichas_tecnicas.id")
    item_id: int = Field(foreign_key="items.id")  # solo items con es_insumo verdadero
    cantidad: Decimal = Field(sa_type=Numeric(14, 4))


class TechnicalSheetServiceLine(SQLModel, table=True):
    """La mano de obra de la ficha. Tabla aparte para no dejar item_id o servicio_id vacios."""

    __tablename__ = "fichas_tecnicas_servicios"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    ficha_tecnica_id: int = Field(foreign_key="fichas_tecnicas.id")
    servicio_id: int = Field(foreign_key="servicios.id")
    cantidad: Decimal = Field(sa_type=Numeric(14, 4), default=1)
