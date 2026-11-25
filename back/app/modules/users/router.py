from fastapi import APIRouter, Depends

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.users import service
from app.modules.users.schemas import UserCreate, UserRead, UserUpdate

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.get("", response_model=list[UserRead])
def list_users(session: SessionDep, empresa_id: CurrentCompanyId):
    # Solo los de la empresa de quien consulta; no hay forma de pedir los de otra.
    return service.list_users(session, empresa_id)


@router.post("", response_model=UserRead, status_code=201)
def create_user(data: UserCreate, session: SessionDep, empresa_id: CurrentCompanyId):
    # La empresa sale de la sesion de quien crea, nunca del cuerpo de la peticion.
    return service.create_user(session, empresa_id, data)


@router.patch("/{user_id}", response_model=UserRead)
def update_user(user_id: int, data: UserUpdate, session: SessionDep, empresa_id: CurrentCompanyId):
    return service.update_user(session, empresa_id, user_id, data)
