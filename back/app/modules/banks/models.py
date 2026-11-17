from sqlmodel import Field, SQLModel


class Bank(SQLModel, table=True):
    """Catalogo global de bancos: sin empresa_id, la misma lista para todas las empresas.

    El usuario no la edita. Se carga y se amplia con migraciones; `activo = False`
    saca un banco del desplegable sin borrarlo (puede haber cuentas que lo usan).
    """

    __tablename__ = "bancos"

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100)
    activo: bool = Field(default=True)
