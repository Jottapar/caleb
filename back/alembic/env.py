"""Script que Alembic ejecuta en cada comando.

Dos diferencias con el que genera `alembic init`:

1. La URL de la base NO se lee de alembic.ini, sino de Settings. El .ini se
   commitea y la URL lleva credenciales.
2. Se importa `app.models` para que SQLModel.metadata conozca las tablas.
   Sin ese import, `--autogenerate` genera migraciones vacias.
"""

from logging.config import fileConfig

from sqlalchemy import create_engine, pool
from sqlmodel import SQLModel

from alembic import context

# Importar el registro de modelos llena SQLModel.metadata. El noqa es porque
# el import parece sin usar, pero es justamente lo que registra las tablas.
import app.models  # noqa: F401
from app.core.config import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Lo que Alembic compara contra la base real para detectar cambios
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Genera el SQL sin conectarse, para revisarlo o aplicarlo a mano."""
    context.configure(
        url=settings.alembic_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Se conecta y aplica las migraciones.

    El engine se crea aqui a mano, en vez de usar
    config.set_main_option("sqlalchemy.url", ...), porque ese metodo pasa el
    valor por ConfigParser, que interpreta el signo % como interpolacion. Una
    contrasena con % romperia la conexion con un error ilegible.

    NullPool: un comando de migracion abre una conexion, la usa y termina.
    Mantener un pool abierto no aporta nada.
    """
    connectable = create_engine(settings.alembic_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Detecta tambien los cambios de tipo de una columna, que por
            # defecto Alembic ignora.
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
