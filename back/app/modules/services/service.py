from sqlmodel import Session, select

from app.core.codes import next_code
from app.core.errors import BusinessError
from app.core.logger import logger
from app.modules.services.models import Service
from app.modules.services.schemas import ServiceCreate


def _generate_code(session: Session, empresa_id: int) -> str:
    return next_code(session, Service, empresa_id, "S")


def create_service(session: Session, empresa_id: int, data: ServiceCreate) -> Service:
    logger.debug(f"Creando servicio {data.nombre}")
    if not data.nombre.strip():
        raise BusinessError("El nombre del servicio es obligatorio")
    if data.costo < 0:
        raise BusinessError("El costo del servicio no puede ser negativo")

    service = Service(
        empresa_id=empresa_id,
        codigo=_generate_code(session, empresa_id),
        nombre=data.nombre.strip(),
        costo=data.costo,
    )
    session.add(service)
    session.commit()
    session.refresh(service)
    logger.info(f"Servicio creado | id={service.id} codigo={service.codigo}")
    return service


def list_services(session: Session, empresa_id: int) -> list[Service]:
    return list(
        session.exec(
            select(Service).where(Service.empresa_id == empresa_id).order_by(Service.id)
        ).all()
    )
