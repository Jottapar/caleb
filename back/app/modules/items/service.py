from decimal import Decimal

from sqlalchemy import case, func
from sqlmodel import Session, select

from app.core.codes import next_code
from app.core.errors import BusinessError, NotFoundError
from app.modules.items.models import InventoryMovement, Item
from app.modules.items.schemas import ItemRead, ItemUpdate, StockMovementLine
from app.modules.taxes.models import Tax
from app.modules.technical_sheets.models import TechnicalSheet, TechnicalSheetItemLine


def _validate_item(nombre: str, se_vende: bool, es_insumo: bool) -> None:
    if not nombre.strip():
        raise BusinessError("El nombre del producto es obligatorio")
    if not se_vende and not es_insumo:
        raise BusinessError("El producto debe venderse, ser insumo, o las dos cosas")


def _validate_tax(session: Session, impuesto_id: int, empresa_id: int) -> None:
    tax = session.exec(
        select(Tax).where(Tax.id == impuesto_id, Tax.empresa_id == empresa_id)
    ).first()
    if not tax:
        raise BusinessError(f"Impuesto invalido: {impuesto_id}")


def _generate_code(session: Session, empresa_id: int) -> str:
    return next_code(session, Item, empresa_id, "P")


def _validate_code(
    session: Session, codigo: str, empresa_id: int, excluding_item_id: int | None = None
) -> None:
    # Al editar, el producto no cuenta contra si mismo: dejar su mismo codigo no es un duplicado.
    query = select(Item).where(Item.codigo == codigo, Item.empresa_id == empresa_id)
    if excluding_item_id is not None:
        query = query.where(Item.id != excluding_item_id)
    existing = session.exec(query).first()
    if existing:
        raise BusinessError(f"Ya existe un producto con el codigo {codigo}")


def _validate_not_used_by_active_sheets(session: Session, item: Item) -> None:
    """Un insumo que una ficha tecnica activa necesita no se puede desactivar."""
    nombres = session.exec(
        select(TechnicalSheet.nombre)
        .join(TechnicalSheetItemLine, TechnicalSheetItemLine.ficha_tecnica_id == TechnicalSheet.id)
        .where(
            TechnicalSheetItemLine.item_id == item.id,
            TechnicalSheet.empresa_id == item.empresa_id,
            TechnicalSheet.activo,
        )
        .order_by(TechnicalSheet.nombre)
    ).all()
    if not nombres:
        return
    if len(nombres) == 1:
        raise BusinessError(
            f"No se puede desactivar {item.nombre} porque la ficha tecnica "
            f"{nombres[0]} lo esta utilizando"
        )
    raise BusinessError(
        f"No se puede desactivar {item.nombre} porque las fichas tecnicas "
        f"{', '.join(nombres)} lo estan utilizando"
    )


def get_stock(session: Session, item_id: int) -> Decimal:
    signo = case((InventoryMovement.tipo == "salida", -1), else_=1)
    total = session.exec(
        select(func.sum(InventoryMovement.cantidad * signo)).where(
            InventoryMovement.item_id == item_id
        )
    ).one()
    return total if total is not None else Decimal(0)


def has_movements(session: Session, item_id: int) -> bool:
    """True si el producto ya tiene al menos un movimiento de inventario."""
    primero = session.exec(
        select(InventoryMovement.id).where(InventoryMovement.item_id == item_id).limit(1)
    ).first()
    return primero is not None


def _with_stock(session: Session, item: Item) -> ItemRead:
    return ItemRead(
        **item.model_dump(),
        existencias=get_stock(session, item.id),
        tiene_movimientos=has_movements(session, item.id),
    )


def create_item(
    session: Session,
    empresa_id: int,
    nombre: str,
    impuesto_id: int,
    codigo: str | None = None,
    unidad: str = "und",
    costo: Decimal = Decimal(0),
    precio_venta: Decimal = Decimal(0),
    se_vende: bool = True,
    es_insumo: bool = False,
    cantidad_inicial: Decimal = Decimal(0),
) -> ItemRead:
    _validate_item(nombre, se_vende, es_insumo)
    _validate_tax(session, impuesto_id, empresa_id)

    if codigo:
        _validate_code(session, codigo, empresa_id)
    else:
        codigo = _generate_code(session, empresa_id)

    item = Item(
        empresa_id=empresa_id,
        codigo=codigo,
        nombre=nombre,
        unidad=unidad,
        costo=costo,
        precio_venta=precio_venta,
        impuesto_id=impuesto_id,
        se_vende=se_vende,
        es_insumo=es_insumo,
    )
    session.add(item)
    session.flush()

    if cantidad_inicial > 0:
        session.add(
            InventoryMovement(
                empresa_id=empresa_id,
                item_id=item.id,
                tipo="entrada",
                cantidad=cantidad_inicial,
                costo_unitario=costo,
                origen="ajuste_manual",
                origen_id=item.id,
            )
        )

    session.commit()
    session.refresh(item)
    return _with_stock(session, item)


def list_items(session: Session, empresa_id: int) -> list[ItemRead]:
    items = session.exec(select(Item).where(Item.empresa_id == empresa_id)).all()
    return [_with_stock(session, item) for item in items]


def get_by_id(session: Session, item_id: int, empresa_id: int) -> Item:
    item = session.exec(
        select(Item).where(Item.id == item_id, Item.empresa_id == empresa_id)
    ).first()
    if not item:
        raise NotFoundError("Producto", item_id)
    return item


def update_item(session: Session, item_id: int, data: ItemUpdate, empresa_id: int) -> ItemRead:
    item = get_by_id(session, item_id, empresa_id)
    cambios = data.model_dump(exclude_unset=True)
    # Se valida con los valores que quedarian despues del cambio: lo enviado, o lo que ya tenia.
    _validate_item(
        cambios.get("nombre", item.nombre),
        cambios.get("se_vende", item.se_vende),
        cambios.get("es_insumo", item.es_insumo),
    )
    if "codigo" in cambios:
        codigo = cambios["codigo"].strip()
        if not codigo:
            raise BusinessError("El codigo del producto es obligatorio")
        _validate_code(session, codigo, empresa_id, excluding_item_id=item.id)
        cambios["codigo"] = codigo
    if "impuesto_id" in cambios:
        _validate_tax(session, cambios["impuesto_id"], empresa_id)
    # Solo importa cuando se desactiva un producto que hoy esta activo
    if cambios.get("activo") is False and item.activo:
        _validate_not_used_by_active_sheets(session, item)

    item.sqlmodel_update(cambios)
    session.add(item)
    session.commit()
    session.refresh(item)
    return _with_stock(session, item)


def add_stock(session: Session, item_id: int, empresa_id: int, cantidad: Decimal) -> ItemRead:
    if cantidad <= 0:
        raise BusinessError("La cantidad a agregar debe ser mayor a cero")

    item = get_by_id(session, item_id, empresa_id)
    session.add(
        InventoryMovement(
            empresa_id=empresa_id,
            item_id=item.id,
            tipo="entrada",
            cantidad=cantidad,
            costo_unitario=item.costo,
            origen="ajuste_manual",
            origen_id=item.id,
        )
    )
    session.commit()
    session.refresh(item)
    return _with_stock(session, item)


def add_stock_bulk(
    session: Session, empresa_id: int, lineas: list[StockMovementLine]
) -> list[ItemRead]:
    items = []
    for linea in lineas:
        if linea.cantidad <= 0:
            raise BusinessError("La cantidad a agregar debe ser mayor a cero")
        items.append(get_by_id(session, linea.item_id, empresa_id))

    for linea, item in zip(lineas, items):
        session.add(
            InventoryMovement(
                empresa_id=empresa_id,
                item_id=item.id,
                tipo="entrada",
                cantidad=linea.cantidad,
                costo_unitario=item.costo,
                origen="ajuste_manual",
                origen_id=item.id,
            )
        )

    session.commit()
    resultado = []
    for item in items:
        session.refresh(item)
        resultado.append(_with_stock(session, item))
    return resultado


def delete_item(session: Session, item_id: int, empresa_id: int) -> None:
    item = get_by_id(session, item_id, empresa_id)
    if has_movements(session, item_id):
        raise BusinessError("No se puede eliminar un producto que ya tiene movimientos de inventario")

    session.delete(item)
    session.commit()
