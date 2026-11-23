from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.modules.banks.models import Bank


class ThirdParty(SQLModel, table=True):
    """Un cliente o proveedor de una empresa. `tipo` lo valida el servicio, no hay enum."""

    __tablename__ = "terceros"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    # Valores validos (los valida el backend): cliente, proveedor. No cambia despues de crearse.
    tipo: str = Field(max_length=20)
    nombre: str = Field(max_length=150)
    documento: str = Field(max_length=30, default="")
    email: str = Field(max_length=150, default="")
    telefono: str = Field(max_length=30, default="")
    direccion: str = Field(max_length=200, default="")
    activo: bool = Field(default=True)

    # La tabla admite varias cuentas, pero en el MVP el servicio deja una sola.
    # delete-orphan: al quitar una cuenta de esta lista, se borra su fila; y al
    # borrar el tercero, se borran sus cuentas.
    cuentas_bancarias: list["ThirdPartyBankAccount"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    @property
    def cuenta_bancaria(self) -> "ThirdPartyBankAccount | None":
        """La unica cuenta del tercero en el MVP, o None si no tiene."""
        return self.cuentas_bancarias[0] if self.cuentas_bancarias else None


class ThirdPartyBankAccount(SQLModel, table=True):
    """Datos bancarios de un tercero. Tabla aparte para que ninguna columna quede vacia:
    un tercero sin cuenta simplemente no tiene fila aqui."""

    __tablename__ = "terceros_cuentas_bancarias"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    tercero_id: int = Field(foreign_key="terceros.id")
    banco_id: int = Field(foreign_key="bancos.id")
    # Valores validos (los valida el backend): ahorros, corriente
    tipo_cuenta: str = Field(max_length=20)
    # Texto y no numero: una cuenta puede empezar por cero y nunca se suma
    numero_cuenta: str = Field(max_length=30)

    banco: "Bank" = Relationship()

    @property
    def banco_nombre(self) -> str:
        return self.banco.nombre
