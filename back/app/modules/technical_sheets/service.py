from decimal import Decimal

from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from app.core.codes import next_code
from app.core.errors import BusinessError, NotFoundError
from app.core.logger import logger
from app.modules.items.models import Item
from app.modules.receipts.models import ReceiptSheetLine
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
    return next_code(session, TechnicalSheet, empresa_id, "F")


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


def _validate_sheet_data(session: Session, empresa_id: int, data: TechnicalSheetCreate) -> None:
    """Las reglas de una ficha, las mismas al crearla y al editarla."""
    if not data.nombre.strip():
        raise BusinessError("El nombre de la ficha tecnica es obligatorio")
    if data.precio_venta < 0:
        raise BusinessError("El precio de venta no puede ser negativo")
    if not data.insumos and not data.servicios:
        raise BusinessError("La ficha tecnica necesita al menos un insumo o un servicio")
    _validate_tax(session, data.impuesto_id, empresa_id)
    _validate_supplies(session, data.insumos, empresa_id)
    _validate_services(session, data.servicios, empresa_id)


def _add_lines(
    session: Session, empresa_id: int, sheet_id: int, data: TechnicalSheetCreate
) -> None:
    for linea in data.insumos:
        session.add(
            TechnicalSheetItemLine(
                empresa_id=empresa_id,
                ficha_tecnica_id=sheet_id,
                item_id=linea.item_id,
                cantidad=linea.cantidad,
            )
        )
    for linea in data.servicios:
        session.add(
            TechnicalSheetServiceLine(
                empresa_id=empresa_id,
                ficha_tecnica_id=sheet_id,
                servicio_id=linea.servicio_id,
                cantidad=linea.cantidad,
            )
        )


def create_technical_sheet(
    session: Session, empresa_id: int, data: TechnicalSheetCreate
) -> TechnicalSheetRead:
    logger.debug(f"Creando ficha tecnica {data.nombre}")
    _validate_sheet_data(session, empresa_id, data)

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

    _add_lines(session, empresa_id, sheet.id, data)

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


def get_by_id(session: Session, sheet_id: int, empresa_id: int) -> TechnicalSheet:
    # Filtrar por empresa hace que una ficha de otra empresa se trate como inexistente
    sheet = session.exec(
        select(TechnicalSheet).where(
            TechnicalSheet.id == sheet_id, TechnicalSheet.empresa_id == empresa_id
        )
    ).first()
    if not sheet:
        raise NotFoundError("Ficha tecnica", sheet_id)
    return sheet


def update_technical_sheet(
    session: Session, sheet_id: int, empresa_id: int, data: TechnicalSheetCreate
) -> TechnicalSheetRead:
    logger.debug(f"Editando ficha tecnica id={sheet_id}")
    sheet = get_by_id(session, sheet_id, empresa_id)
    _validate_sheet_data(session, empresa_id, data)

    sheet.nombre = data.nombre.strip()
    sheet.precio_venta = data.precio_venta
    sheet.impuesto_id = data.impuesto_id
    # Editar una ficha siempre cuenta como edicion. Las lineas son tablas aparte (sin relacion en
    # el modelo): si solo ellas cambian, SQLAlchemy no ve cambios en la ficha y su fecha y su
    # editor no se actualizarian. `flag_modified` la marca como modificada de todos modos.
    flag_modified(sheet, "updated_at")
    session.add(sheet)

    # Las lineas se reemplazan completas: se borran las viejas y se crean las que llegan,
    # todo en el mismo commit. Si algo falla, la ficha queda como estaba.
    for linea in session.exec(
        select(TechnicalSheetItemLine).where(TechnicalSheetItemLine.ficha_tecnica_id == sheet.id)
    ).all():
        session.delete(linea)
    for linea in session.exec(
        select(TechnicalSheetServiceLine).where(
            TechnicalSheetServiceLine.ficha_tecnica_id == sheet.id
        )
    ).all():
        session.delete(linea)
    # flush ejecuta los DELETE antes de los INSERT
    session.flush()
    _add_lines(session, empresa_id, sheet.id, data)

    session.commit()
    session.refresh(sheet)
    logger.info(f"Ficha tecnica editada | id={sheet.id} codigo={sheet.codigo}")
    return _to_read(session, sheet)


def set_active(
    session: Session, sheet_id: int, empresa_id: int, activo: bool
) -> TechnicalSheetRead:
    sheet = get_by_id(session, sheet_id, empresa_id)
    sheet.activo = activo
    session.add(sheet)
    session.commit()
    session.refresh(sheet)
    logger.info(f"Ficha tecnica {'activada' if activo else 'desactivada'} | id={sheet.id}")
    return _to_read(session, sheet)


def delete_technical_sheet(session: Session, sheet_id: int, empresa_id: int) -> None:
    sheet = get_by_id(session, sheet_id, empresa_id)
    # Una ficha que aparece en cualquier recibo (aunque este anulado) tiene historia: no se borra.
    en_recibo = session.exec(
        select(ReceiptSheetLine.id).where(ReceiptSheetLine.ficha_tecnica_id == sheet.id).limit(1)
    ).first()
    if en_recibo:
        raise BusinessError("No se puede eliminar una ficha tecnica que ya esta en un recibo")

    # Las lineas dependen de la ficha por llave foranea: se borran primero, en el mismo commit.
    for linea in session.exec(
        select(TechnicalSheetItemLine).where(TechnicalSheetItemLine.ficha_tecnica_id == sheet.id)
    ).all():
        session.delete(linea)
    for linea in session.exec(
        select(TechnicalSheetServiceLine).where(
            TechnicalSheetServiceLine.ficha_tecnica_id == sheet.id
        )
    ).all():
        session.delete(linea)
    session.flush()
    session.delete(sheet)
    session.commit()
    logger.info(f"Ficha tecnica eliminada | id={sheet_id}")
