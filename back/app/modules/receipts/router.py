from fastapi import APIRouter, Depends, status

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.receipts import service
from app.modules.receipts.schemas import ReceiptCreate, ReceiptRead

router = APIRouter(
    prefix="/receipts",
    tags=["receipts"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.post("", response_model=ReceiptRead, status_code=status.HTTP_201_CREATED)
def create_receipt(data: ReceiptCreate, session: SessionDep, empresa_id: CurrentCompanyId):
    return service.create_receipt(
        session, empresa_id=empresa_id, tercero_id=data.tercero_id, lineas=data.lineas, notas=data.notas
    )


@router.get("", response_model=list[ReceiptRead])
def list_receipts(session: SessionDep, empresa_id: CurrentCompanyId):
    return service.list_receipts(session, empresa_id)


@router.get("/{receipt_id}", response_model=ReceiptRead)
def get_receipt(receipt_id: int, session: SessionDep, empresa_id: CurrentCompanyId):
    return service.get_by_id(session, receipt_id, empresa_id)
