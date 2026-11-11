from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core import database
from app.core.database import SessionDep
from app.core.errors import UnauthorizedError
from app.core.security import auth
from app.modules.auth.service import CREDENCIALES_INVALIDAS
from app.modules.users import service as users_service
from app.modules.users.models import User


@auth.set_subject_getter
def get_user_from_uid(uid: str) -> User | None:
    # AuthX solo pasa el uid, no hay Depends aqui: se abre una sesion aparte,
    # contra `database.engine` (no uno importado suelto) para que los tests
    # puedan apuntarlo a la base de prueba con monkeypatch.
    with Session(database.engine, join_transaction_mode="create_savepoint") as session:
        return users_service.get_active_user(session, int(uid))


def get_current_user(user: User | None = Depends(auth.get_current_subject)) -> User:
    # AuthX no lanza nada si el subject getter devuelve None (token valido de
    # un usuario que ya no existe o se desactivo): sin este chequeo, el
    # endpoint recibiria None y explotaria con un 500 en vez de un 401.
    if user is None:
        raise UnauthorizedError(CREDENCIALES_INVALIDAS)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_company_id(current_user: CurrentUser, session: SessionDep) -> int:
    return users_service.get_company_id(session, current_user.id)


CurrentCompanyId = Annotated[int, Depends(get_current_company_id)]
