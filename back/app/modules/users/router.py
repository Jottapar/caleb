from fastapi import APIRouter, Depends, status

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId, CurrentUser
from app.modules.users import service
from app.modules.users.schemas import PasswordChange, PasswordReset, UserCreate, UserListRead, UserRead, UserUpdate

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.get("", response_model=list[UserListRead])
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


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, session: SessionDep, empresa_id: CurrentCompanyId):
    service.delete_user(session, empresa_id, user_id)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(data: PasswordChange, session: SessionDep, current_user: CurrentUser):
    # El usuario sale de la sesión, nunca de la URL ni del cuerpo: nadie cambia la contraseña de otro.
    service.change_password(session, current_user.id, data.current_password, data.new_password)


@router.post("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def reset_user_password(
    user_id: int,
    data: PasswordReset,
    session: SessionDep,
    empresa_id: CurrentCompanyId,
    current_user: CurrentUser,
):
    service.reset_user_password(session, empresa_id, current_user.id, user_id, data.new_password)
