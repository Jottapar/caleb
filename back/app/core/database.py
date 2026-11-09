from typing import Annotated

from fastapi import Depends
from sqlmodel import Session, create_engine

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    # Comprueba que la conexion este viva antes de usarla. Neon cierra las
    # conexiones inactivas, y sin esto la primera peticion despues de un rato
    # falla con "server closed the connection unexpectedly".
    pool_pre_ping=True,
)


def get_session():
    """Abre una sesion por peticion y la cierra al terminar.

    El `yield` es lo que permite a FastAPI ejecutar el cierre despues de
    responder, incluso si el endpoint lanzo una excepcion.
    """
    with Session(engine) as session:
        yield session


# Alias para no repetir Depends(get_session) en cada endpoint
SessionDep = Annotated[Session, Depends(get_session)]
