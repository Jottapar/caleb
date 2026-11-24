from fastapi import APIRouter, Depends

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.companies import service
from app.modules.companies.schemas import CompanyRead, CompanyUpdate

# Sin id en la URL: siempre es la empresa del usuario logueado.
router = APIRouter(
    prefix="/company",
    tags=["company"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.get("", response_model=CompanyRead)
def get_company(session: SessionDep, empresa_id: CurrentCompanyId):
    return service.get_company(session, empresa_id)


@router.patch("", response_model=CompanyRead)
def update_company(data: CompanyUpdate, session: SessionDep, empresa_id: CurrentCompanyId):
    return service.update_company(session, empresa_id, data)
