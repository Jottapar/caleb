from fastapi import APIRouter, Depends

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.taxes import service
from app.modules.taxes.schemas import TaxRead

router = APIRouter(
    prefix="/taxes",
    tags=["taxes"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.get("", response_model=list[TaxRead])
def list_taxes(session: SessionDep, empresa_id: CurrentCompanyId):
    return service.list_taxes(session, empresa_id)
