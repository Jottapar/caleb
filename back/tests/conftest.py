import pytest
from fastapi.testclient import TestClient
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
