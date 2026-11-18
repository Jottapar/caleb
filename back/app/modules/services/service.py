from decimal import Decimal

from sqlmodel import Session, select

from app.core.errors import BusinessError
from app.core.logger import logger
from app.modules.items.models import Item
from app.modules.services.models import Service, TechnicalSheetLine
from app.modules.services.schemas import (
    ServiceCreate,
    ServiceRead,
    TechnicalSheetLineCreate,
    TechnicalSheetLineRead,
)
from app.modules.taxes.models import Tax


def _validate_tax(session: Session, impuesto_id: int, empresa_id: int) -> None:
    tax = session.exec(
        select(Tax).where(Tax.id == impuesto_id, Tax.empresa_id == empresa_id)
    ).first()
    if not tax:
        raise BusinessError(f"Impuesto invalido: {impuesto_id}")


def _validate_supplies(
    session: Session, insumos: list[TechnicalSheetLineCreate], empresa_id: int
) -> None:
    if not insumos:
        raise BusinessError("El servicio necesita al menos un insumo")

    item_ids = [linea.item_id for linea in insumos]
    if len(item_ids) != len(set(item_ids)):
        raise BusinessError("Un insumo no se puede repetir en la ficha tecnica")

    for linea in insumos:
        if linea.cantidad <= 0:
            raise BusinessError("La cantidad de cada insumo debe ser mayor a cero")
        # Filtrar por empresa hace que un item de otra empresa se trate como inexistente
        item = session.exec(
            select(Item).where(Item.id == linea.item_id, Item.empresa_id == empresa_id)
        ).first()
        if not item:
            raise BusinessError(f"Insumo invalido: {linea.item_id}")
        if not item.es_insumo:
            raise BusinessError(f"{item.nombre} no esta marcado como insumo")


def _generate_code(session: Session, empresa_id: int) -> str:
    total = session.exec(select(Service).where(Service.empresa_id == empresa_id)).all()
    return f"S-{len(total) + 1:04d}"


def _to_read(session: Session, service: Service) -> ServiceRead:
    # Una sola consulta trae cada linea de la ficha junto con su insumo
    filas = session.exec(
        select(TechnicalSheetLine, Item)
        .join(Item, Item.id == TechnicalSheetLine.item_id)
        .where(TechnicalSheetLine.servicio_id == service.id)
        .order_by(TechnicalSheetLine.id)
    ).all()
    insumos = [
        TechnicalSheetLineRead(
            item_id=item.id,
            codigo=item.codigo,
            nombre=item.nombre,
            cantidad=linea.cantidad,
            costo_unitario=item.costo,
        )
        for linea, item in filas
    ]
    costo = sum((insumo.costo_unitario * insumo.cantidad for insumo in insumos), Decimal(0))
    return ServiceRead(
        **service.model_dump(),
        costo=costo.quantize(Decimal("0.01")),
        insumos=insumos,
    )


def create_service(session: Session, empresa_id: int, data: ServiceCreate) -> ServiceRead:
    logger.debug(f"Creando servicio {data.nombre}")
    if not data.nombre.strip():
        raise BusinessError("El nombre del servicio es obligatorio")
    if data.precio_venta < 0:
        raise BusinessError("El precio de venta no puede ser negativo")
    _validate_tax(session, data.impuesto_id, empresa_id)
    _validate_supplies(session, data.insumos, empresa_id)

    service = Service(
        empresa_id=empresa_id,
        codigo=_generate_code(session, empresa_id),
        nombre=data.nombre.strip(),
        precio_venta=data.precio_venta,
        impuesto_id=data.impuesto_id,
    )
    session.add(service)
    # flush asigna el id del servicio sin cerrar la transaccion: la ficha se guarda en el mismo commit
    session.flush()

    for linea in data.insumos:
        session.add(
            TechnicalSheetLine(
                empresa_id=empresa_id,
                servicio_id=service.id,
                item_id=linea.item_id,
                cantidad=linea.cantidad,
            )
        )

    session.commit()
    session.refresh(service)
    logger.info(f"Servicio creado | id={service.id} codigo={service.codigo}")
    return _to_read(session, service)


def list_services(session: Session, empresa_id: int) -> list[ServiceRead]:
    services = session.exec(
        select(Service).where(Service.empresa_id == empresa_id).order_by(Service.id)
    ).all()
    return [_to_read(session, service) for service in services]
