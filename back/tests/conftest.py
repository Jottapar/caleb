import pytest
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401 (registra todos los modelos en la metadata)
from app.core.config import settings


@pytest.fixture(scope="session")
def engine():
    engine = create_engine(settings.TEST_DATABASE_URL)
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
def session(engine):
    # Todo lo que haga el test (incluidos los commits) se revierte al final,
    # asi los tests no se ensucian entre si.
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    transaction.rollback()
    connection.close()
