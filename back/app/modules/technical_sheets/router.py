from fastapi import APIRouter, Depends, status

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.technical_sheets import service
from app.modules.technical_sheets.schemas import TechnicalSheetCreate, TechnicalSheetRead

router = APIRouter(
    prefix="/technical-sheets",
    tags=["technical-sheets"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.post("", response_model=TechnicalSheetRead, status_code=status.HTTP_201_CREATED)
def create_technical_sheet(
    data: TechnicalSheetCreate, session: SessionDep, empresa_id: CurrentCompanyId
):
    return service.create_technical_sheet(session, empresa_id, data)


@router.get("", response_model=list[TechnicalSheetRead])
def list_technical_sheets(session: SessionDep, empresa_id: CurrentCompanyId):
    return service.list_technical_sheets(session, empresa_id)
