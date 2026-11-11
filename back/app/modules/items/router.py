from fastapi import APIRouter, Depends, status

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.items import service
from app.modules.items.schemas import ItemCreate, ItemRead, ItemUpdate, StockMovementCreate

router = APIRouter(
    prefix="/items",
    tags=["items"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.post("", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
def create_item(data: ItemCreate, session: SessionDep, empresa_id: CurrentCompanyId):
    return service.create_item(session, empresa_id=empresa_id, **data.model_dump())


@router.get("", response_model=list[ItemRead])
def list_items(session: SessionDep, empresa_id: CurrentCompanyId):
    return service.list_items(session, empresa_id)


@router.patch("/{item_id}", response_model=ItemRead)
def update_item(item_id: int, data: ItemUpdate, session: SessionDep, empresa_id: CurrentCompanyId):
    return service.update_item(session, item_id, data, empresa_id)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, session: SessionDep, empresa_id: CurrentCompanyId):
    service.delete_item(session, item_id, empresa_id)


@router.post("/{item_id}/stock-movements", response_model=ItemRead)
def add_stock(
    item_id: int, data: StockMovementCreate, session: SessionDep, empresa_id: CurrentCompanyId
):
    return service.add_stock(session, item_id, empresa_id, data.cantidad)
