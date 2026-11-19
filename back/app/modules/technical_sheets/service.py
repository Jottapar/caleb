from decimal import Decimal

from sqlmodel import Session, select

from app.core.errors import BusinessError
from app.core.logger import logger
from app.modules.items.models import Item
from app.modules.services.models import Service
from app.modules.taxes.models import Tax
from app.modules.technical_sheets.models import (
    TechnicalSheet,
    TechnicalSheetItemLine,
    TechnicalSheetServiceLine,
)
from app.modules.technical_sheets.schemas import (
    SheetItemLineCreate,
    SheetItemLineRead,
    SheetServiceLineCreate,
    SheetServiceLineRead,
    TechnicalSheetCreate,
    TechnicalSheetRead,
)


def _validate_tax(session: Session, impuesto_id: int, empresa_id: int) -> None:
    tax = session.exec(
        select(Tax).where(Tax.id == impuesto_id, Tax.empresa_id == empresa_id)
    ).first()
    if not tax:
        raise BusinessError(f"Impuesto invalido: {impuesto_id}")


def _validate_supplies(
    session: Session, insumos: list[SheetItemLineCreate], empresa_id: int
) -> None:
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


def _validate_services(
    session: Session, servicios: list[SheetServiceLineCreate], empresa_id: int
) -> None:
    service_ids = [linea.servicio_id for linea in servicios]
    if len(service_ids) != len(set(service_ids)):
        raise BusinessError("Un servicio no se puede repetir en la ficha tecnica")

    for linea in servicios:
        if linea.cantidad <= 0:
            raise BusinessError("La cantidad de cada servicio debe ser mayor a cero")
        service = session.exec(
            select(Service).where(
                Service.id == linea.servicio_id, Service.empresa_id == empresa_id
            )
        ).first()
        if not service:
            raise BusinessError(f"Servicio invalido: {linea.servicio_id}")


def _generate_code(session: Session, empresa_id: int) -> str:
    total = session.exec(
        select(TechnicalSheet).where(TechnicalSheet.empresa_id == empresa_id)
    ).all()
    return f"F-{len(total) + 1:04d}"


def _to_read(session: Session, sheet: TechnicalSheet) -> TechnicalSheetRead:
    # Una consulta por clase de linea: cada fila de la ficha viene junto con su insumo o servicio
    filas_insumos = session.exec(
        select(TechnicalSheetItemLine, Item)
        .join(Item, Item.id == TechnicalSheetItemLine.item_id)
        .where(TechnicalSheetItemLine.ficha_tecnica_id == sheet.id)
        .order_by(TechnicalSheetItemLine.id)
    ).all()
    filas_servicios = session.exec(
        select(TechnicalSheetServiceLine, Service)
        .join(Service, Service.id == TechnicalSheetServiceLine.servicio_id)
        .where(TechnicalSheetServiceLine.ficha_tecnica_id == sheet.id)
        .order_by(TechnicalSheetServiceLine.id)
    ).all()

    insumos = [
        SheetItemLineRead(
            item_id=item.id,
            codigo=item.codigo,
            nombre=item.nombre,
            cantidad=linea.cantidad,
            costo_unitario=item.costo,
        )
        for linea, item in filas_insumos
    ]
    servicios = [
        SheetServiceLineRead(
            servicio_id=service.id,
            codigo=service.codigo,
            nombre=service.nombre,
            cantidad=linea.cantidad,
            costo_unitario=service.costo,
        )
        for linea, service in filas_servicios
    ]
    costo = sum(
        (linea.costo_unitario * linea.cantidad for linea in [*insumos, *servicios]),
        Decimal(0),
    )
    return TechnicalSheetRead(
        **sheet.model_dump(),
        costo=costo.quantize(Decimal("0.01")),
        insumos=insumos,
        servicios=servicios,
    )


def create_technical_sheet(
    session: Session, empresa_id: int, data: TechnicalSheetCreate
) -> TechnicalSheetRead:
    logger.debug(f"Creando ficha tecnica {data.nombre}")
    if not data.nombre.strip():
        raise BusinessError("El nombre de la ficha tecnica es obligatorio")
    if data.precio_venta < 0:
        raise BusinessError("El precio de venta no puede ser negativo")
    if not data.insumos and not data.servicios:
        raise BusinessError("La ficha tecnica necesita al menos un insumo o un servicio")
    _validate_tax(session, data.impuesto_id, empresa_id)
    _validate_supplies(session, data.insumos, empresa_id)
    _validate_services(session, data.servicios, empresa_id)

    sheet = TechnicalSheet(
        empresa_id=empresa_id,
        codigo=_generate_code(session, empresa_id),
        nombre=data.nombre.strip(),
        precio_venta=data.precio_venta,
        impuesto_id=data.impuesto_id,
    )
    session.add(sheet)
    # flush asigna el id de la ficha sin cerrar la transaccion: las lineas se guardan en el mismo commit
    session.flush()

    for linea in data.insumos:
        session.add(
            TechnicalSheetItemLine(
                empresa_id=empresa_id,
                ficha_tecnica_id=sheet.id,
                item_id=linea.item_id,
                cantidad=linea.cantidad,
            )
        )
    for linea in data.servicios:
        session.add(
            TechnicalSheetServiceLine(
                empresa_id=empresa_id,
                ficha_tecnica_id=sheet.id,
                servicio_id=linea.servicio_id,
                cantidad=linea.cantidad,
            )
        )

    session.commit()
    session.refresh(sheet)
    logger.info(f"Ficha tecnica creada | id={sheet.id} codigo={sheet.codigo}")
    return _to_read(session, sheet)


def list_technical_sheets(session: Session, empresa_id: int) -> list[TechnicalSheetRead]:
    sheets = session.exec(
        select(TechnicalSheet)
        .where(TechnicalSheet.empresa_id == empresa_id)
        .order_by(TechnicalSheet.id)
    ).all()
    return [_to_read(session, sheet) for sheet in sheets]
