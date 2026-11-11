from sqlmodel import SQLModel


class ThirdPartyCreate(SQLModel):
    tipo: str
    nombre: str
    documento: str = ""
    email: str = ""
    telefono: str = ""


class ThirdPartyRead(SQLModel):
    id: int
    tipo: str
    nombre: str
    documento: str
    email: str
    telefono: str
    activo: bool
