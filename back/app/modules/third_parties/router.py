from fastapi import APIRouter, Depends, status

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.third_parties import service
from app.modules.third_parties.schemas import ThirdPartyCreate, ThirdPartyRead

router = APIRouter(
    prefix="/third-parties",
    tags=["third-parties"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.post("", response_model=ThirdPartyRead, status_code=status.HTTP_201_CREATED)
def create_third_party(data: ThirdPartyCreate, session: SessionDep, empresa_id: CurrentCompanyId):
    return service.create_third_party(session, empresa_id=empresa_id, **data.model_dump())


@router.get("", response_model=list[ThirdPartyRead])
def list_third_parties(session: SessionDep, empresa_id: CurrentCompanyId):
    return service.list_third_parties(session, empresa_id)
