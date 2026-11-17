from fastapi import APIRouter, Depends

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.banks import service
from app.modules.banks.schemas import BankRead

router = APIRouter(
    prefix="/banks",
    tags=["banks"],
    dependencies=[Depends(auth.access_token_required)],
)


@router.get("", response_model=list[BankRead])
def list_banks(session: SessionDep):
    return service.list_active_banks(session)
