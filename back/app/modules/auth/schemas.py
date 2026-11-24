from sqlmodel import SQLModel


class LoginRequest(SQLModel):
    email: str
    password: str


class MeRead(SQLModel):
    user_name: str
    company_name: str
    # Ruta del logo actual ('' si no tiene). Cambia con cada logo nuevo: el front la usa para
    # no mostrar el logo viejo que el navegador guardo en cache.
    logo_version: str
