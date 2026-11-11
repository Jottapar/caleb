from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlmodel import Session, select

from app.core.errors import BusinessError, NotFoundError
from app.modules.items import service as items_service
from app.modules.items.models import InventoryMovement, Item
from app.modules.receipts.models import AccountReceivablePayment, Receipt, ReceiptItemLine
from app.modules.receipts.schemas import ReceiptItemLineCreate, ReceiptRead
from app.modules.taxes.models import Tax
from app.modules.third_parties.models import ThirdParty

TERCEROS_VALIDOS_EN_RECIBO = {"cliente", "ambos"}


def _round(monto: Decimal) -> Decimal:
    return monto.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _validate_third_party(session: Session, tercero_id: int, empresa_id: int) -> None:
    tercero = session.exec(
        select(ThirdParty).where(ThirdParty.id == tercero_id, ThirdParty.empresa_id == empresa_id)
    ).first()
    if not tercero:
        raise NotFoundError("Tercero", tercero_id)
    if tercero.tipo not in TERCEROS_VALIDOS_EN_RECIBO:
        raise BusinessError("El tercero del recibo debe ser cliente o ambos")


def _generate_numero(session: Session, empresa_id: int) -> str:
    total = session.exec(select(Receipt).where(Receipt.empresa_id == empresa_id)).all()
    return f"R-{len(total) + 1:04d}"


def _get_item_for_line(session: Session, item_id: int, empresa_id: int, cantidad: Decimal) -> Item:
    item = session.exec(
        select(Item).where(Item.id == item_id, Item.empresa_id == empresa_id)
    ).first()
    if not item:
        raise NotFoundError("Producto", item_id)
    if not item.se_vende:
        raise BusinessError(f"El producto {item.nombre} no esta marcado para venderse")
    if items_service.get_stock(session, item.id) < cantidad:
        raise BusinessError(f"No hay existencias suficientes de {item.nombre}")
    return item


def create_receipt(
    session: Session,
    empresa_id: int,
    tercero_id: int,
    lineas: list[ReceiptItemLineCreate],
    notas: str = "",
) -> ReceiptRead:
    if not lineas:
        raise BusinessError("El recibo debe tener al menos una linea")

    _validate_third_party(session, tercero_id, empresa_id)
    numero = _generate_numero(session, empresa_id)

    items_by_line = []
    for linea in lineas:
        if linea.cantidad <= 0:
            raise BusinessError("La cantidad de cada linea debe ser mayor a cero")
        item = _get_item_for_line(session, linea.item_id, empresa_id, linea.cantidad)
        tax = session.get(Tax, item.impuesto_id)
        items_by_line.append((linea, item, tax))

    fecha = date.today()
    receipt = Receipt(
        empresa_id=empresa_id,
        tercero_id=tercero_id,
        numero=numero,
        fecha=fecha,
        condicion="contado",
        fecha_vencimiento=fecha,
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

    receipt.subtotal = subtotal
    receipt.impuestos_total = impuestos_total
    receipt.total = subtotal + impuestos_total
    session.add(receipt)

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


def _with_lines(session: Session, receipt: Receipt) -> ReceiptRead:
    lineas = session.exec(
        select(ReceiptItemLine).where(ReceiptItemLine.recibo_id == receipt.id)
    ).all()
    return ReceiptRead(**receipt.model_dump(), lineas=list(lineas))


def list_receipts(session: Session, empresa_id: int) -> list[ReceiptRead]:
    receipts = session.exec(select(Receipt).where(Receipt.empresa_id == empresa_id)).all()
    return [_with_lines(session, receipt) for receipt in receipts]


def get_by_id(session: Session, receipt_id: int, empresa_id: int) -> ReceiptRead:
    receipt = session.exec(
        select(Receipt).where(Receipt.id == receipt_id, Receipt.empresa_id == empresa_id)
    ).first()
    if not receipt:
        raise NotFoundError("Recibo", receipt_id)
    return _with_lines(session, receipt)
