from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlmodel import Session, select

from app.core.errors import BusinessError, NotFoundError
from app.modules.items import service as items_service
from app.modules.items.models import InventoryMovement, Item
from app.modules.receipts.models import (
    AccountReceivablePayment,
    Receipt,
    ReceiptItemLine,
    ReceiptSheetLine,
)
from app.modules.receipts.schemas import (
    ReceiptItemLineCreate,
    ReceiptRead,
    ReceiptSheetLineCreate,
)
from app.modules.taxes.models import Tax
from app.modules.technical_sheets.models import TechnicalSheet, TechnicalSheetItemLine
from app.modules.third_parties.models import ThirdParty

TERCEROS_VALIDOS_EN_RECIBO = {"cliente"}
CONDICIONES_VALIDAS = {"contado", "credito"}


def _round(monto: Decimal) -> Decimal:
    return monto.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _validate_third_party(session: Session, tercero_id: int, empresa_id: int) -> None:
    tercero = session.exec(
        select(ThirdParty).where(ThirdParty.id == tercero_id, ThirdParty.empresa_id == empresa_id)
    ).first()
    if not tercero:
        raise NotFoundError("Tercero", tercero_id)
    if tercero.tipo not in TERCEROS_VALIDOS_EN_RECIBO:
        raise BusinessError("El tercero del recibo debe ser un cliente")


def _generate_numero(session: Session, empresa_id: int) -> str:
    total = session.exec(select(Receipt).where(Receipt.empresa_id == empresa_id)).all()
    return f"R-{len(total) + 1:04d}"


def _validate_condicion(condicion: str, fecha_vencimiento: date | None) -> None:
    if condicion not in CONDICIONES_VALIDAS:
        raise BusinessError(f"Condicion invalida: {condicion}")
    if condicion == "credito" and fecha_vencimiento is None:
        raise BusinessError("La fecha de vencimiento es obligatoria en un recibo a credito")


def _get_item_for_line(session: Session, item_id: int, empresa_id: int) -> Item:
    item = session.exec(
        select(Item).where(Item.id == item_id, Item.empresa_id == empresa_id)
    ).first()
    if not item:
        raise NotFoundError("Producto", item_id)
    if not item.se_vende:
        raise BusinessError(f"El producto {item.nombre} no esta marcado para venderse")
    if not item.activo:
        raise BusinessError(f"El producto {item.nombre} esta inactivo")
    return item


def _get_sheet_for_line(session: Session, sheet_id: int, empresa_id: int) -> TechnicalSheet:
    sheet = session.exec(
        select(TechnicalSheet).where(
            TechnicalSheet.id == sheet_id, TechnicalSheet.empresa_id == empresa_id
        )
    ).first()
    if not sheet:
        raise NotFoundError("Ficha tecnica", sheet_id)
    if not sheet.activo:
        raise BusinessError(f"La ficha tecnica {sheet.nombre} esta inactiva")
    return sheet


def _validate_stock(session: Session, demanda: dict[int, Decimal]) -> None:
    """`demanda` es item_id -> cuanto necesita TODO el recibo de ese item (suelto + insumos)."""
    for item_id, necesario in demanda.items():
        if items_service.get_stock(session, item_id) < necesario:
            item = session.get(Item, item_id)
            raise BusinessError(f"No hay existencias suficientes de {item.nombre}")


def create_receipt(
    session: Session,
    empresa_id: int,
    tercero_id: int,
    lineas: list[ReceiptItemLineCreate],
    lineas_fichas: list[ReceiptSheetLineCreate] | None = None,
    condicion: str = "contado",
    fecha_vencimiento: date | None = None,
    notas: str = "",
) -> ReceiptRead:
    lineas_fichas = lineas_fichas or []
    if not lineas and not lineas_fichas:
        raise BusinessError("El recibo debe tener al menos una linea")

    _validate_condicion(condicion, fecha_vencimiento)
    _validate_third_party(session, tercero_id, empresa_id)
    numero = _generate_numero(session, empresa_id)

    # Primero se valida y se junta todo, sin escribir nada: si algo falla, no queda nada a medias.
    # `demanda` suma lo que necesita TODO el recibo de cada item: el suelto y los insumos de fichas.
    demanda: dict[int, Decimal] = {}

    items_by_line = []
    for linea in lineas:
        if linea.cantidad <= 0:
            raise BusinessError("La cantidad de cada linea debe ser mayor a cero")
        item = _get_item_for_line(session, linea.item_id, empresa_id)
        tax = session.get(Tax, item.impuesto_id)
        items_by_line.append((linea, item, tax))
        demanda[item.id] = demanda.get(item.id, Decimal(0)) + linea.cantidad

    sheets_by_line = []
    for linea in lineas_fichas:
        if linea.cantidad <= 0:
            raise BusinessError("La cantidad de cada linea debe ser mayor a cero")
        sheet = _get_sheet_for_line(session, linea.ficha_tecnica_id, empresa_id)
        tax = session.get(Tax, sheet.impuesto_id)
        insumos = session.exec(
            select(TechnicalSheetItemLine, Item)
            .join(Item, Item.id == TechnicalSheetItemLine.item_id)
            .where(TechnicalSheetItemLine.ficha_tecnica_id == sheet.id)
        ).all()
        sheets_by_line.append((linea, sheet, tax, insumos))
        for insumo, item in insumos:
            necesario = insumo.cantidad * linea.cantidad
            demanda[item.id] = demanda.get(item.id, Decimal(0)) + necesario

    _validate_stock(session, demanda)

    fecha = date.today()
    receipt = Receipt(
        empresa_id=empresa_id,
        tercero_id=tercero_id,
        numero=numero,
        fecha=fecha,
        condicion=condicion,
        fecha_vencimiento=fecha_vencimiento if condicion == "credito" else fecha,
        estado="emitido",
        notas=notas,
    )
    session.add(receipt)
    session.flush()

    subtotal = Decimal(0)
    impuestos_total = Decimal(0)
    for linea, item, tax in items_by_line:
        total_linea = _round(linea.cantidad * item.precio_venta)
        impuesto_linea = _round(total_linea * tax.porcentaje / 100)
        session.add(
            ReceiptItemLine(
                recibo_id=receipt.id,
                item_id=item.id,
                descripcion=item.nombre,
                cantidad=linea.cantidad,
                precio_unitario=item.precio_venta,
                impuesto_porcentaje=tax.porcentaje,
                total_linea=total_linea,
            )
        )
        session.add(
            InventoryMovement(
                empresa_id=empresa_id,
                item_id=item.id,
                tipo="salida",
                cantidad=linea.cantidad,
                costo_unitario=item.costo,
                origen="recibo",
                origen_id=receipt.id,
            )
        )
        subtotal += total_linea
        impuestos_total += impuesto_linea

    for linea, sheet, tax, insumos in sheets_by_line:
        total_linea = _round(linea.cantidad * sheet.precio_venta)
        impuesto_linea = _round(total_linea * tax.porcentaje / 100)
        session.add(
            ReceiptSheetLine(
                recibo_id=receipt.id,
                ficha_tecnica_id=sheet.id,
                descripcion=sheet.nombre,
                cantidad=linea.cantidad,
                precio_unitario=sheet.precio_venta,
                impuesto_porcentaje=tax.porcentaje,
                total_linea=total_linea,
            )
        )
        # Una salida por cada insumo de la ficha, con el costo del insumo en este momento.
        # Los servicios de la ficha no mueven inventario.
        for insumo, item in insumos:
            session.add(
                InventoryMovement(
                    empresa_id=empresa_id,
                    item_id=item.id,
                    tipo="salida",
                    cantidad=insumo.cantidad * linea.cantidad,
                    costo_unitario=item.costo,
                    origen="recibo",
                    origen_id=receipt.id,
                )
            )
        subtotal += total_linea
        impuestos_total += impuesto_linea

    receipt.subtotal = subtotal
    receipt.impuestos_total = impuestos_total
    receipt.total = subtotal + impuestos_total
    session.add(receipt)

    if condicion == "contado":
        session.add(
            AccountReceivablePayment(
                empresa_id=empresa_id,
                recibo_id=receipt.id,
                monto=receipt.total,
                fecha=fecha,
                nota="Pago de contado",
            )
        )

    session.commit()
    return get_by_id(session, receipt.id, empresa_id)


def get_balance(session: Session, receipt: Receipt) -> Decimal:
    pagos_activos = session.exec(
        select(AccountReceivablePayment).where(
            AccountReceivablePayment.recibo_id == receipt.id,
            AccountReceivablePayment.estado == "activo",
        )
    ).all()
    return receipt.total - sum((pago.monto for pago in pagos_activos), Decimal(0))


def _with_lines(session: Session, receipt: Receipt) -> ReceiptRead:
    lineas = session.exec(
        select(ReceiptItemLine).where(ReceiptItemLine.recibo_id == receipt.id)
    ).all()
    lineas_fichas = session.exec(
        select(ReceiptSheetLine).where(ReceiptSheetLine.recibo_id == receipt.id)
    ).all()
    return ReceiptRead(
        **receipt.model_dump(),
        saldo=get_balance(session, receipt),
        lineas=list(lineas),
        lineas_fichas=list(lineas_fichas),
    )


def list_receipts(session: Session, empresa_id: int) -> list[ReceiptRead]:
    receipts = session.exec(select(Receipt).where(Receipt.empresa_id == empresa_id)).all()
    return [_with_lines(session, receipt) for receipt in receipts]


def list_accounts_receivable(session: Session, empresa_id: int) -> list[ReceiptRead]:
    receipts = session.exec(
        select(Receipt).where(Receipt.empresa_id == empresa_id, Receipt.estado == "emitido")
    ).all()
    pendientes = [receipt for receipt in receipts if get_balance(session, receipt) > 0]
    return [_with_lines(session, receipt) for receipt in pendientes]


def _get_receipt(session: Session, receipt_id: int, empresa_id: int) -> Receipt:
    receipt = session.exec(
        select(Receipt).where(Receipt.id == receipt_id, Receipt.empresa_id == empresa_id)
    ).first()
    if not receipt:
        raise NotFoundError("Recibo", receipt_id)
    return receipt


def get_by_id(session: Session, receipt_id: int, empresa_id: int) -> ReceiptRead:
    receipt = _get_receipt(session, receipt_id, empresa_id)
    return _with_lines(session, receipt)


def cancel_receipt(session: Session, receipt_id: int, empresa_id: int) -> ReceiptRead:
    receipt = _get_receipt(session, receipt_id, empresa_id)
    if receipt.estado != "emitido":
        raise BusinessError("Solo se puede cancelar un recibo emitido")

    # Se revierte cada salida que el recibo creo (items vendidos e insumos de fichas), con la
    # misma cantidad y costo: lo que realmente se descontó, no lo que hoy diga la ficha.
    salidas = session.exec(
        select(InventoryMovement).where(
            InventoryMovement.empresa_id == empresa_id,
            InventoryMovement.origen == "recibo",
            InventoryMovement.origen_id == receipt.id,
            InventoryMovement.tipo == "salida",
        )
    ).all()
    for salida in salidas:
        session.add(
            InventoryMovement(
                empresa_id=empresa_id,
                item_id=salida.item_id,
                tipo="entrada",
                cantidad=salida.cantidad,
                costo_unitario=salida.costo_unitario,
                origen="recibo",
                origen_id=receipt.id,
            )
        )

    # Todos los pagos del recibo se anulan, no se borran: el de contado, o los abonos si es a credito
    pagos = session.exec(
        select(AccountReceivablePayment).where(AccountReceivablePayment.recibo_id == receipt.id)
    ).all()
    for pago in pagos:
        pago.estado = "anulado"
        session.add(pago)

    receipt.estado = "anulado"
    session.add(receipt)
    session.commit()
    return _with_lines(session, receipt)
