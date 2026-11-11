from sqlmodel import SQLModel


class ThirdPartyCreate(SQLModel):
    tipo: str
    nombre: str
    documento: str = ""
    email: str = ""
    telefono: str = ""


class ThirdPartyUpdate(SQLModel):
    tipo: str | None = None
    nombre: str | None = None
    documento: str | None = None
    email: str | None = None
    telefono: str | None = None


class ThirdPartyRead(SQLModel):
    id: int
    tipo: str
    nombre: str
    documento: str
    email: str
    telefono: str
    activo: bool
