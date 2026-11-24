from sqlmodel import SQLModel


class UserCreate(SQLModel):
    """Lo que manda el Admin para crear un usuario en su empresa."""

    nombre: str
    email: str
    rol: str
    password: str


class UserRead(SQLModel):
    """Lo que devuelve la API de un usuario. Nunca incluye `password_hash`."""

    id: int
    nombre: str
    email: str
    rol: str
    activo: bool
