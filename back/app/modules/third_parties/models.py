from sqlmodel import Field, SQLModel


class ThirdParty(SQLModel, table=True):
    """Un cliente o proveedor de una empresa. `tipo` lo valida el servicio, no hay enum."""

    __tablename__ = "terceros"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    # Valores validos (los valida el backend): cliente, proveedor, ambos
    tipo: str = Field(max_length=20)
    nombre: str = Field(max_length=150)
    documento: str = Field(max_length=30, default="")
    email: str = Field(max_length=150, default="")
    telefono: str = Field(max_length=30, default="")
    activo: bool = Field(default=True)
