from fastapi import APIRouter, Depends, status

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth.dependencies import CurrentCompanyId
from app.modules.items import service
from app.modules.items.schemas import ItemCreate, ItemRead

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
