from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuracion de la app, leida del .env.

    Pydantic valida y convierte los tipos al arrancar: si falta DATABASE_URL o
    DB_ECHO no es un booleano, la app no levanta. Es a proposito: mejor fallar
    al arrancar que a mitad de una peticion.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "local"
    DATABASE_URL: str
    DB_ECHO: bool = False
    # Solo para Alembic. En Neon el pooler (PgBouncer en pool_mode=transaction)
    # no soporta SET/RESET ni advisory locks de sesion, asi que las migraciones
    # van contra el endpoint directo. Vacio = usar DATABASE_URL (caso local).
    MIGRATION_DATABASE_URL: str = ""
    # Origenes que el navegador puede usar para llamar a la API (el front en dev)
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    @property
    def alembic_url(self) -> str:
        """URL que usan las migraciones."""
        return self.MIGRATION_DATABASE_URL or self.DATABASE_URL


settings = Settings()
