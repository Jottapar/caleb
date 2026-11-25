import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401 (registra todos los modelos en la metadata)
from app.core import database
from app.core.config import settings
from app.core.database import get_session
from app.main import app


@pytest.fixture(scope="session")
def engine():
    engine = create_engine(settings.TEST_DATABASE_URL)
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    # Caleb (el sistema) se crea una vez y se confirma aquí, fuera de la transaccion de cada test:
    # asi el rollback del final de un test no lo borra. "!" no es un hash valido: nadie entra con él.
    # Es su propio autor, y el id solo se conoce al insertar: por eso se pide el siguiente de la
    # secuencia y se usa en las tres columnas dentro de un solo INSERT.
    with Session(engine) as session:
        session.execute(
            text(
                """
                WITH siguiente AS (SELECT nextval(pg_get_serial_sequence('usuarios', 'id')) AS id)
                INSERT INTO usuarios
                    (id, nombre, email, password_hash, activo,
                     created_at, updated_at, created_by_id, updated_by_id)
                SELECT id, 'Caleb', 'caleb@caleb.com', '!', false, now(), now(), id, id
                FROM siguiente
                """
            )
        )
        session.commit()
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
def connection(engine):
    # Una conexion con una sola transaccion para todo el test, que nunca se
    # confirma: al final se revierte, asi los tests no se ensucian entre si.
    connection = engine.connect()
    transaction = connection.begin()
    yield connection
    transaction.rollback()
    connection.close()


@pytest.fixture
def session(connection):
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()


@pytest.fixture
def client(session, connection, monkeypatch):
    app.dependency_overrides[get_session] = lambda: session
    # `get_user_from_uid` (modules/auth/dependencies.py) abre su propia sesion
    # porque AuthX no deja inyectarla con Depends. Si usara el engine real,
    # esa sesion abriria OTRA conexion a Postgres, que no puede ver los datos
    # sin confirmar de la transaccion de este test. Apuntando `database.engine`
    # a la misma `connection`, las dos sesiones comparten la misma transaccion.
    monkeypatch.setattr(database, "engine", connection)
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
