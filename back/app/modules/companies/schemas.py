from sqlmodel import SQLModel


class CompanyUpdate(SQLModel):
    """PATCH parcial: solo cambian los campos que llegan."""

    nombre: str | None = None
    documento_fiscal: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email: str | None = None


class CompanyRead(SQLModel):
    """Los datos de la empresa que se muestran y se editan en la pantalla Empresa."""

    nombre: str
    documento_fiscal: str
    direccion: str
    telefono: str
    email: str
