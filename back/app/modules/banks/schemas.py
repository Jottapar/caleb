from sqlmodel import SQLModel


class BankRead(SQLModel):
    id: int
    nombre: str
