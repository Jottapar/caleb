from datetime import date
from decimal import Decimal

from sqlalchemy import Numeric
from sqlmodel import Field

from app.core.mixins import AuditMixin


class Receipt(AuditMixin, table=True):
    """Un recibo de venta. `condicion` y `estado` los valida el servicio, no hay enum."""

    __tablename__ = "recibos"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    tercero_id: int = Field(foreign_key="terceros.id")
    numero: str = Field(max_length=30)
    fecha: date
    # Valores validos (los valida el backend): contado, credito
    condicion: str = Field(max_length=20, default="contado")
    fecha_vencimiento: date
    # Valores validos: borrador, emitido, anulado
    estado: str = Field(max_length=20, default="borrador")
    subtotal: Decimal = Field(sa_type=Numeric(14, 2), default=0)
    impuestos_total: Decimal = Field(sa_type=Numeric(14, 2), default=0)
    total: Decimal = Field(sa_type=Numeric(14, 2), default=0)
    notas: str = Field(max_length=255, default="")


class ReceiptItemLine(AuditMixin, table=True):
    """Una linea de ítem de un recibo. Copia nombre, precio e impuesto al momento de vender."""

    __tablename__ = "recibo_lineas_items"

    id: int | None = Field(default=None, primary_key=True)
    recibo_id: int = Field(foreign_key="recibos.id")
    item_id: int = Field(foreign_key="items.id")
    descripcion: str = Field(max_length=150)
    cantidad: Decimal = Field(sa_type=Numeric(14, 4))
    precio_unitario: Decimal = Field(sa_type=Numeric(14, 2))
    impuesto_porcentaje: Decimal = Field(sa_type=Numeric(5, 2))
    total_linea: Decimal = Field(sa_type=Numeric(14, 2))


class ReceiptSheetLine(AuditMixin, table=True):
    """Una ficha tecnica vendida en un recibo. Copia nombre, precio e impuesto al vender.

    Tabla aparte de `recibo_lineas_items` para no dejar `item_id` o `ficha_tecnica_id` vacios.
    """

    __tablename__ = "recibo_lineas_fichas"

    id: int | None = Field(default=None, primary_key=True)
    recibo_id: int = Field(foreign_key="recibos.id")
    ficha_tecnica_id: int = Field(foreign_key="fichas_tecnicas.id")
    descripcion: str = Field(max_length=150)
    cantidad: Decimal = Field(sa_type=Numeric(14, 4))
    precio_unitario: Decimal = Field(sa_type=Numeric(14, 2))
    impuesto_porcentaje: Decimal = Field(sa_type=Numeric(5, 2))
    total_linea: Decimal = Field(sa_type=Numeric(14, 2))


class AccountReceivablePayment(AuditMixin, table=True):
    """Un abono a un recibo. La deuda no se guarda: es `recibos.total` menos la suma de estos."""

    __tablename__ = "pagos_cuentas_por_cobrar"

    id: int | None = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="empresas.id")
    recibo_id: int = Field(foreign_key="recibos.id")
    monto: Decimal = Field(sa_type=Numeric(14, 2))
    fecha: date
    # Valores validos (los valida el backend): activo, anulado
    estado: str = Field(max_length=20, default="activo")
    nota: str = Field(max_length=255, default="")
