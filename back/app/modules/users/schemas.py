from sqlmodel import SQLModel


class UserCreate(SQLModel):
    """Lo que manda el Admin para crear un usuario en su empresa."""

    nombre: str
    email: str
    rol: str
    password: str


class UserUpdate(SQLModel):
    """Lo que manda el Admin para editar un usuario de su empresa. No incluye la contraseña.

    Todo es opcional: lo que no llega se queda como estaba.
    """

    nombre: str | None = None
    email: str | None = None
    rol: str | None = None
    activo: bool | None = None


class UserRead(SQLModel):
    """Lo que devuelve la API de un usuario. Nunca incluye `password_hash`."""

    id: int
    nombre: str
    email: str
    rol: str
    activo: bool


class UserListRead(UserRead):
    """Un usuario en la lista: lo mismo que `UserRead` y si tiene historial.

    `tiene_historial` se calcula al listar, no se guarda. Solo la lista lo trae: crear y editar
    devuelven `UserRead`.
    """

    tiene_historial: bool


class PasswordChange(SQLModel):
    """Lo que manda un usuario para cambiar su propia contraseña. La confirmación la valida el front."""

    current_password: str
    new_password: str


class PasswordReset(SQLModel):
    """Lo que manda el Admin para ponerle una contraseña nueva a otro usuario. No lleva la actual."""

    new_password: str
