from fastapi import APIRouter, Depends

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.users import service
from app.modules.users.schemas import UserCreate, UserRead

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.post("", response_model=UserRead, status_code=201)
def create_user(data: UserCreate, session: SessionDep, empresa_id: CurrentCompanyId):
    # La empresa sale de la sesion de quien crea, nunca del cuerpo de la peticion.
    return service.create_user(session, empresa_id, data)
