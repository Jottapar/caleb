from fastapi import APIRouter, Depends, Response, UploadFile

from app.core.database import SessionDep
from app.core.security import auth
from app.core.storage import StorageDep
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


@router.put("/logo", status_code=204)
def upload_logo(file: UploadFile, session: SessionDep, storage: StorageDep, empresa_id: CurrentCompanyId):
    # `def` y no `async def`: file.file es un archivo normal y se lee de forma sincrona.
    # Se lee con tope (el maximo + 1 byte): asi nunca se carga en memoria mas de eso, y si llegan
    # mas bytes, el servicio ve que se paso del maximo y rechaza.
    contenido = file.file.read(service.PESO_MAXIMO_LOGO + 1)
    service.save_logo(session, storage, empresa_id, contenido, file.content_type)


@router.get("/logo")
def get_logo(session: SessionDep, storage: StorageDep, empresa_id: CurrentCompanyId):
    contenido, media_type = service.read_logo(session, storage, empresa_id)
    return Response(content=contenido, media_type=media_type)


@router.delete("/logo", status_code=204)
def remove_logo(session: SessionDep, storage: StorageDep, empresa_id: CurrentCompanyId):
    service.remove_logo(session, storage, empresa_id)
