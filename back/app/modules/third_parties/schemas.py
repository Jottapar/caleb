from sqlmodel import SQLModel


class BankAccountData(SQLModel):
    """Los datos bancarios que llegan al crear o editar. Los tres son obligatorios
    juntos: no se guarda una cuenta a medias."""

    banco_id: int
    tipo_cuenta: str
    numero_cuenta: str


class BankAccountRead(SQLModel):
    banco_id: int
    banco_nombre: str
    tipo_cuenta: str
    numero_cuenta: str


# Los campos obligatorios llevan default "" a proposito: si faltan, el servicio
# responde con un error en espanol y en el formato de la API, en vez del error
# en ingles de la validacion automatica.
class ThirdPartyCreate(SQLModel):
    tipo: str
    nombre: str
    documento: str = ""
    email: str = ""
    telefono: str = ""
    direccion: str = ""
    cuenta_bancaria: BankAccountData | None = None


class ThirdPartyUpdate(SQLModel):
    """PATCH parcial. En `cuenta_bancaria`: si no se envia, no cambia; si se envia
    `null`, se borra la cuenta; si se envia un objeto, reemplaza la que habia."""

    tipo: str | None = None
    nombre: str | None = None
    documento: str | None = None
    email: str | None = None
    telefono: str | None = None
    direccion: str | None = None
    activo: bool | None = None
    cuenta_bancaria: BankAccountData | None = None


class ThirdPartyRead(SQLModel):
    id: int
    tipo: str
    nombre: str
    documento: str
    email: str
    telefono: str
    direccion: str
    activo: bool
    cuenta_bancaria: BankAccountRead | None
