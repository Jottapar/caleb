from fastapi import APIRouter, Depends, status

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.services import service
from app.modules.services.schemas import ServiceCreate, ServiceRead

router = APIRouter(
    prefix="/services",
    tags=["services"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(data: ServiceCreate, session: SessionDep, empresa_id: CurrentCompanyId):
    return service.create_service(session, empresa_id, data)


@router.get("", response_model=list[ServiceRead])
def list_services(session: SessionDep, empresa_id: CurrentCompanyId):
    return service.list_services(session, empresa_id)
