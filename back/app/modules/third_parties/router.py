from fastapi import APIRouter, Depends, status

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.third_parties import service
from app.modules.third_parties.schemas import ThirdPartyCreate, ThirdPartyRead, ThirdPartyUpdate

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


@router.patch("/{third_party_id}", response_model=ThirdPartyRead)
def update_third_party(
    third_party_id: int, data: ThirdPartyUpdate, session: SessionDep, empresa_id: CurrentCompanyId
):
    return service.update_third_party(session, third_party_id, data, empresa_id)


@router.delete("/{third_party_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_third_party(third_party_id: int, session: SessionDep, empresa_id: CurrentCompanyId):
    service.delete_third_party(session, third_party_id, empresa_id)
