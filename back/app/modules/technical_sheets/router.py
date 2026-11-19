from fastapi import APIRouter, Depends, status

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.technical_sheets import service
from app.modules.technical_sheets.schemas import (
    TechnicalSheetActiveUpdate,
    TechnicalSheetCreate,
    TechnicalSheetRead,
)

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


@router.put("/{sheet_id}", response_model=TechnicalSheetRead)
def update_technical_sheet(
    sheet_id: int,
    data: TechnicalSheetCreate,
    session: SessionDep,
    empresa_id: CurrentCompanyId,
):
    return service.update_technical_sheet(session, sheet_id, empresa_id, data)


@router.patch("/{sheet_id}", response_model=TechnicalSheetRead)
def set_technical_sheet_active(
    sheet_id: int,
    data: TechnicalSheetActiveUpdate,
    session: SessionDep,
    empresa_id: CurrentCompanyId,
):
    return service.set_active(session, sheet_id, empresa_id, data.activo)


@router.delete("/{sheet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_technical_sheet(sheet_id: int, session: SessionDep, empresa_id: CurrentCompanyId):
    service.delete_technical_sheet(session, sheet_id, empresa_id)
