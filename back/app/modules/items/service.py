from decimal import Decimal

from sqlalchemy import case, func
from sqlmodel import Session, select

from app.core.errors import BusinessError, NotFoundError
from app.modules.items.models import InventoryMovement, Item
from app.modules.items.schemas import ItemRead, ItemUpdate
from app.modules.taxes.models import Tax


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
    total = session.exec(select(Item).where(Item.empresa_id == empresa_id)).all()
    return f"P-{len(total) + 1:04d}"


def _validate_code(session: Session, codigo: str, empresa_id: int) -> None:
    existing = session.exec(
        select(Item).where(Item.codigo == codigo, Item.empresa_id == empresa_id)
    ).first()
    if existing:
        raise BusinessError(f"Ya existe un producto con el codigo {codigo}")


def get_stock(session: Session, item_id: int) -> Decimal:
    signo = case((InventoryMovement.tipo == "salida", -1), else_=1)
    total = session.exec(
        select(func.sum(InventoryMovement.cantidad * signo)).where(
            InventoryMovement.item_id == item_id
        )
    ).one()
    return total if total is not None else Decimal(0)


def _with_stock(session: Session, item: Item) -> ItemRead:
    return ItemRead(**item.model_dump(), existencias=get_stock(session, item.id))


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
    _validate_item(cambios.get("nombre", item.nombre), item.se_vende, item.es_insumo)
    if "impuesto_id" in cambios:
        _validate_tax(session, cambios["impuesto_id"], empresa_id)

    item.sqlmodel_update(cambios)
    session.add(item)
    session.commit()
    session.refresh(item)
    return _with_stock(session, item)
