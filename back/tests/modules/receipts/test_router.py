from datetime import date
from decimal import Decimal

from sqlmodel import select

from app.modules.companies.models import Company
from app.modules.items import service as items_service
from app.modules.items.models import InventoryMovement
from app.modules.receipts import service as receipts_service
from app.modules.receipts.models import (
    AccountReceivablePayment,
    Receipt,
    ReceiptItemLine,
    ReceiptSheetLine,
)
from app.modules.receipts.schemas import ReceiptItemLineCreate
from app.modules.taxes.models import Tax
from app.modules.third_parties import service as third_parties_service
from app.modules.third_parties.schemas import ThirdPartyCreate
from app.modules.users.models import User
from tests.modules.receipts.conftest import EMAIL, PASSWORD

URL = "/api/v1/receipts"
ITEMS_URL = "/api/v1/items"
THIRD_PARTIES_URL = "/api/v1/third-parties"
# Los campos obligatorios de un tercero; cada test cambia solo tipo y nombre.
THIRD_PARTY_DATA = {
    "documento": "123",
    "email": "tercero@example.com",
    "telefono": "3001234567",
    "direccion": "Calle 1 # 2-3",
}


def _csrf_headers(logged_in_client):
    return {"X-CSRF-TOKEN": logged_in_client.cookies.get("csrf_access_token")}


def _sin_impuesto_id(session) -> int:
    empresa = session.exec(select(Company).where(Company.nombre == "Panadería Luna")).one()
    return (
        session.exec(select(Tax).where(Tax.nombre == "Sin impuesto", Tax.empresa_id == empresa.id))
        .one()
        .id
    )


def _create_cliente(logged_in_client) -> int:
    response = logged_in_client.post(
        THIRD_PARTIES_URL,
        json={"tipo": "cliente", "nombre": "Cliente de prueba", **THIRD_PARTY_DATA},
        headers=_csrf_headers(logged_in_client),
    )
    return response.json()["id"]


def _create_item(logged_in_client, session, **overrides) -> dict:
    payload = {
        "nombre": "Pan",
        "impuesto_id": _sin_impuesto_id(session),
        "precio_venta": "5000",
        "costo": "2000",
        "cantidad_inicial": "10",
    }
    payload.update(overrides)
    response = logged_in_client.post(ITEMS_URL, json=payload, headers=_csrf_headers(logged_in_client))
    return response.json()


def test_create_receipt_returns_201_with_generated_number_and_totals(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session)

    response = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "2"}]},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["numero"] == "R-0001"
    assert body["subtotal"] == "10000.00"
    assert body["impuestos_total"] == "0.00"
    assert body["total"] == "10000.00"


def test_create_receipt_decreases_item_stock(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session, cantidad_inicial="10")

    logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "3"}]},
        headers=_csrf_headers(logged_in_client),
    )

    existencias = {
        producto["nombre"]: producto["existencias"]
        for producto in logged_in_client.get(ITEMS_URL).json()
    }
    assert existencias["Pan"] == "7.0000"


def test_create_receipt_registers_automatic_payment_for_full_total(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session)

    response = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "2"}]},
        headers=_csrf_headers(logged_in_client),
    )

    receipt_id = response.json()["id"]
    pago = session.exec(
        select(AccountReceivablePayment).where(AccountReceivablePayment.recibo_id == receipt_id)
    ).one()
    assert str(pago.monto) == response.json()["total"]


def test_create_receipt_rejects_empty_lines(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)

    response = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": []},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_receipt_rejects_item_not_marked_for_sale(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session, se_vende=False, es_insumo=True)

    response = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "1"}]},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_receipt_rejects_quantity_greater_than_available_stock(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session, cantidad_inicial="2")

    response = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "5"}]},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_list_receipts_returns_only_current_company_with_number(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno_item = items_service.create_item(
        session,
        empresa_id=otra_empresa.id,
        nombre="Item Ajeno",
        impuesto_id=otro_impuesto.id,
        precio_venta=Decimal("1000"),
        cantidad_inicial=Decimal("5"),
    )
    ajeno_tercero = third_parties_service.create_third_party(
        session,
        otra_empresa.id,
        ThirdPartyCreate(tipo="cliente", nombre="Cliente Ajeno", **THIRD_PARTY_DATA),
    )
    receipts_service.create_receipt(
        session,
        empresa_id=otra_empresa.id,
        tercero_id=ajeno_tercero.id,
        lineas=[ReceiptItemLineCreate(item_id=ajeno_item.id, cantidad=Decimal("1"))],
    )

    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session)
    logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "1"}]},
        headers=_csrf_headers(logged_in_client),
    )

    response = logged_in_client.get(URL)

    assert response.status_code == 200
    recibos = response.json()
    assert len(recibos) == 1
    assert recibos[0]["numero"] == "R-0001"


def test_create_receipt_rejects_unknown_third_party(logged_in_client, session):
    item = _create_item(logged_in_client, session)

    response = logged_in_client.post(
        URL,
        json={"tercero_id": 99999, "lineas": [{"item_id": item["id"], "cantidad": "1"}]},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404


def test_create_receipt_rejects_third_party_of_type_proveedor(logged_in_client, session):
    item = _create_item(logged_in_client, session)
    proveedor = logged_in_client.post(
        THIRD_PARTIES_URL,
        json={"tipo": "proveedor", "nombre": "Proveedor de prueba", **THIRD_PARTY_DATA},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.post(
        URL,
        json={"tercero_id": proveedor["id"], "lineas": [{"item_id": item["id"], "cantidad": "1"}]},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["message"] == "El tercero del recibo debe ser un cliente"


def test_create_receipt_rejects_item_from_other_company(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno_item = items_service.create_item(
        session, empresa_id=otra_empresa.id, nombre="Item Ajeno", impuesto_id=otro_impuesto.id
    )

    response = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": ajeno_item.id, "cantidad": "1"}]},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404


def test_get_receipt_returns_detail_with_lines(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session)
    created = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "2"}]},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.get(f"{URL}/{created['id']}")

    assert response.status_code == 200
    body = response.json()
    assert len(body["lineas"]) == 1
    assert body["lineas"][0]["descripcion"] == "Pan"
    assert body["lineas"][0]["cantidad"] == "2.0000"


def test_get_receipt_from_other_company_returns_404(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno_item = items_service.create_item(
        session,
        empresa_id=otra_empresa.id,
        nombre="Item Ajeno",
        impuesto_id=otro_impuesto.id,
        precio_venta=Decimal("1000"),
        cantidad_inicial=Decimal("5"),
    )
    ajeno_tercero = third_parties_service.create_third_party(
        session,
        otra_empresa.id,
        ThirdPartyCreate(tipo="cliente", nombre="Cliente Ajeno", **THIRD_PARTY_DATA),
    )
    ajeno_recibo = receipts_service.create_receipt(
        session,
        empresa_id=otra_empresa.id,
        tercero_id=ajeno_tercero.id,
        lineas=[ReceiptItemLineCreate(item_id=ajeno_item.id, cantidad=Decimal("1"))],
    )

    response = logged_in_client.get(f"{URL}/{ajeno_recibo.id}")

    assert response.status_code == 404


def test_create_receipt_requires_authentication(client):
    response = client.post(
        URL, json={"tercero_id": 1, "lineas": [{"item_id": 1, "cantidad": "1"}]}
    )

    assert response.status_code == 401


def test_cancel_receipt_reverts_stock_and_cancels_payment(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session, cantidad_inicial="10")
    created = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "3"}]},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.post(
        f"{URL}/{created['id']}/cancel", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "anulado"
    existencias = {
        producto["nombre"]: producto["existencias"]
        for producto in logged_in_client.get(ITEMS_URL).json()
    }
    assert existencias["Pan"] == "10.0000"
    pago = session.exec(
        select(AccountReceivablePayment).where(AccountReceivablePayment.recibo_id == created["id"])
    ).one()
    assert pago.estado == "anulado"


def test_cancel_receipt_already_cancelled_rejects(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session)
    created = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "1"}]},
        headers=_csrf_headers(logged_in_client),
    ).json()
    logged_in_client.post(f"{URL}/{created['id']}/cancel", headers=_csrf_headers(logged_in_client))

    response = logged_in_client.post(
        f"{URL}/{created['id']}/cancel", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_cancel_receipt_from_other_company_returns_404(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno_item = items_service.create_item(
        session,
        empresa_id=otra_empresa.id,
        nombre="Item Ajeno",
        impuesto_id=otro_impuesto.id,
        precio_venta=Decimal("1000"),
        cantidad_inicial=Decimal("5"),
    )
    ajeno_tercero = third_parties_service.create_third_party(
        session,
        otra_empresa.id,
        ThirdPartyCreate(tipo="cliente", nombre="Cliente Ajeno", **THIRD_PARTY_DATA),
    )
    ajeno_recibo = receipts_service.create_receipt(
        session,
        empresa_id=otra_empresa.id,
        tercero_id=ajeno_tercero.id,
        lineas=[ReceiptItemLineCreate(item_id=ajeno_item.id, cantidad=Decimal("1"))],
    )

    response = logged_in_client.post(
        f"{URL}/{ajeno_recibo.id}/cancel", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 404


def test_cancel_receipt_requires_authentication(client):
    response = client.post(f"{URL}/1/cancel")

    assert response.status_code == 401


def test_create_credit_receipt_does_not_register_payment(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session, cantidad_inicial="10")

    response = logged_in_client.post(
        URL,
        json={
            "tercero_id": cliente_id,
            "condicion": "credito",
            "fecha_vencimiento": "2026-12-01",
            "lineas": [{"item_id": item["id"], "cantidad": "3"}],
        },
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 201
    receipt_id = response.json()["id"]
    pago = session.exec(
        select(AccountReceivablePayment).where(AccountReceivablePayment.recibo_id == receipt_id)
    ).first()
    assert pago is None
    existencias = {
        producto["nombre"]: producto["existencias"]
        for producto in logged_in_client.get(ITEMS_URL).json()
    }
    assert existencias["Pan"] == "7.0000"


def test_create_credit_receipt_requires_fecha_vencimiento(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session)

    response = logged_in_client.post(
        URL,
        json={
            "tercero_id": cliente_id,
            "condicion": "credito",
            "lineas": [{"item_id": item["id"], "cantidad": "1"}],
        },
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_contado_receipt_has_zero_balance(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session)

    response = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "1"}]},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.json()["saldo"] == "0.00"


def test_accounts_receivable_lists_only_pending_receipts_with_balance(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session, cantidad_inicial="20")
    logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "1"}]},
        headers=_csrf_headers(logged_in_client),
    )
    credito = logged_in_client.post(
        URL,
        json={
            "tercero_id": cliente_id,
            "condicion": "credito",
            "fecha_vencimiento": "2026-12-01",
            "lineas": [{"item_id": item["id"], "cantidad": "2"}],
        },
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.get(f"{URL}/accounts-receivable")

    assert response.status_code == 200
    cuentas = response.json()
    assert len(cuentas) == 1
    assert cuentas[0]["id"] == credito["id"]
    assert cuentas[0]["saldo"] == credito["total"]
    assert cuentas[0]["fecha_vencimiento"] == "2026-12-01"


def test_accounts_receivable_returns_only_current_company(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno_item = items_service.create_item(
        session,
        empresa_id=otra_empresa.id,
        nombre="Item Ajeno",
        impuesto_id=otro_impuesto.id,
        precio_venta=Decimal("1000"),
        cantidad_inicial=Decimal("5"),
    )
    ajeno_tercero = third_parties_service.create_third_party(
        session,
        otra_empresa.id,
        ThirdPartyCreate(tipo="cliente", nombre="Cliente Ajeno", **THIRD_PARTY_DATA),
    )
    receipts_service.create_receipt(
        session,
        empresa_id=otra_empresa.id,
        tercero_id=ajeno_tercero.id,
        condicion="credito",
        fecha_vencimiento=date(2026, 12, 1),
        lineas=[ReceiptItemLineCreate(item_id=ajeno_item.id, cantidad=Decimal("1"))],
    )

    response = logged_in_client.get(f"{URL}/accounts-receivable")

    assert response.status_code == 200
    assert response.json() == []


def test_accounts_receivable_requires_authentication(client):
    response = client.get(f"{URL}/accounts-receivable")

    assert response.status_code == 401


# ---------- Fichas tecnicas en el recibo ----------
SHEETS_URL = "/api/v1/technical-sheets"
SERVICES_URL = "/api/v1/services"


def _create_servicio(logged_in_client, costo="8000") -> dict:
    return logged_in_client.post(
        SERVICES_URL,
        json={"nombre": "Corte de pelo", "costo": costo},
        headers=_csrf_headers(logged_in_client),
    ).json()


def _create_sheet(logged_in_client, session, insumos, **overrides) -> dict:
    """Una ficha 'Corte completo' con un servicio y los insumos dados: [(item, cantidad), ...]."""
    servicio = _create_servicio(logged_in_client)
    body = {
        "nombre": "Corte completo",
        "impuesto_id": _sin_impuesto_id(session),
        "precio_venta": "25000",
        "insumos": [{"item_id": item["id"], "cantidad": str(cantidad)} for item, cantidad in insumos],
        "servicios": [{"servicio_id": servicio["id"], "cantidad": "1"}],
    }
    body.update(overrides)
    return logged_in_client.post(
        SHEETS_URL, json=body, headers=_csrf_headers(logged_in_client)
    ).json()


def _gel(logged_in_client, session, cantidad_inicial="10") -> dict:
    return _create_item(
        logged_in_client,
        session,
        nombre="Gel",
        costo="1000",
        se_vende=False,
        es_insumo=True,
        cantidad_inicial=cantidad_inicial,
    )


def _post_receipt(logged_in_client, cliente_id, **body):
    return logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, **body},
        headers=_csrf_headers(logged_in_client),
    )


def _existencias(logged_in_client, item_id) -> Decimal:
    items = logged_in_client.get(ITEMS_URL).json()
    return Decimal(next(i for i in items if i["id"] == item_id)["existencias"])


def test_receipt_sells_a_sheet_with_its_price_and_discounts_its_supplies(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    gel = _gel(logged_in_client, session)
    ficha = _create_sheet(logged_in_client, session, [(gel, "0.5")])

    response = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas_fichas=[{"ficha_tecnica_id": ficha["id"], "cantidad": "3"}],
    )

    assert response.status_code == 201
    body = response.json()
    assert body["lineas"] == []
    assert len(body["lineas_fichas"]) == 1
    linea = body["lineas_fichas"][0]
    assert linea["descripcion"] == "Corte completo"
    assert linea["precio_unitario"] == "25000.00"
    assert linea["total_linea"] == "75000.00"
    assert body["total"] == "75000.00"
    # 0,5 de gel por ficha x 3 fichas = 1,5 de gel menos
    assert _existencias(logged_in_client, gel["id"]) == Decimal("8.5")


def test_receipt_can_mix_items_and_sheets(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    pan = _create_item(logged_in_client, session)
    gel = _gel(logged_in_client, session)
    ficha = _create_sheet(logged_in_client, session, [(gel, 1)])

    response = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas=[{"item_id": pan["id"], "cantidad": "2"}],
        lineas_fichas=[{"ficha_tecnica_id": ficha["id"], "cantidad": "1"}],
    )

    assert response.status_code == 201
    # 2 x 5.000 (pan) + 1 x 25.000 (ficha)
    assert response.json()["total"] == "35000.00"


def test_receipt_rejects_without_any_line(logged_in_client):
    cliente_id = _create_cliente(logged_in_client)

    response = _post_receipt(logged_in_client, cliente_id)

    assert response.status_code == 422


def test_receipt_rejects_sheet_when_a_supply_has_not_enough_stock_and_writes_nothing(
    logged_in_client, session
):
    cliente_id = _create_cliente(logged_in_client)
    gel = _gel(logged_in_client, session, cantidad_inicial="2")
    ficha = _create_sheet(logged_in_client, session, [(gel, 1)])

    response = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas_fichas=[{"ficha_tecnica_id": ficha["id"], "cantidad": "3"}],
    )

    assert response.status_code == 422
    assert "Gel" in response.json()["message"]
    assert _existencias(logged_in_client, gel["id"]) == Decimal("2")
    assert logged_in_client.get(URL).json() == []


def test_stock_is_validated_adding_up_the_whole_receipt(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    # El gel se vende suelto y tambien es insumo de la ficha: hay 10 en total
    gel = _create_item(
        logged_in_client, session, nombre="Gel", se_vende=True, es_insumo=True,
        cantidad_inicial="10", costo="1000",
    )
    ficha = _create_sheet(logged_in_client, session, [(gel, 1)])

    # 6 sueltos + 6 por las fichas = 12 > 10, aunque cada linea sola si alcanzaria
    response = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas=[{"item_id": gel["id"], "cantidad": "6"}],
        lineas_fichas=[{"ficha_tecnica_id": ficha["id"], "cantidad": "6"}],
    )

    assert response.status_code == 422
    assert _existencias(logged_in_client, gel["id"]) == Decimal("10")


def test_receipt_rejects_an_inactive_sheet(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    gel = _gel(logged_in_client, session)
    ficha = _create_sheet(logged_in_client, session, [(gel, 1)])
    logged_in_client.patch(
        f"{SHEETS_URL}/{ficha['id']}", json={"activo": False}, headers=_csrf_headers(logged_in_client)
    )

    response = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas_fichas=[{"ficha_tecnica_id": ficha["id"], "cantidad": "1"}],
    )

    assert response.status_code == 422
    assert "inactiva" in response.json()["message"]


def test_receipt_rejects_an_inactive_item(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    pan = _create_item(logged_in_client, session)
    logged_in_client.patch(
        f"{ITEMS_URL}/{pan['id']}", json={"activo": False}, headers=_csrf_headers(logged_in_client)
    )

    response = _post_receipt(
        logged_in_client, cliente_id, lineas=[{"item_id": pan["id"], "cantidad": "1"}]
    )

    assert response.status_code == 422
    assert "inactivo" in response.json()["message"]


def test_receipt_rejects_a_sheet_from_another_company(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)

    response = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas_fichas=[{"ficha_tecnica_id": 9999, "cantidad": "1"}],
    )

    assert response.status_code == 404


def test_cancel_receipt_gives_back_the_supplies_of_its_sheets(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    gel = _gel(logged_in_client, session)
    ficha = _create_sheet(logged_in_client, session, [(gel, 2)])
    recibo = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas_fichas=[{"ficha_tecnica_id": ficha["id"], "cantidad": "3"}],
    ).json()
    assert _existencias(logged_in_client, gel["id"]) == Decimal("4")

    response = logged_in_client.post(
        f"{URL}/{recibo['id']}/cancel", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 200
    assert _existencias(logged_in_client, gel["id"]) == Decimal("10")


def test_cancel_gives_back_what_was_discounted_even_if_the_sheet_changed_later(
    logged_in_client, session
):
    cliente_id = _create_cliente(logged_in_client)
    gel = _gel(logged_in_client, session)
    ficha = _create_sheet(logged_in_client, session, [(gel, 2)])
    recibo = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas_fichas=[{"ficha_tecnica_id": ficha["id"], "cantidad": "1"}],
    ).json()
    # La ficha se edita despues de la venta: ahora gasta 5 de gel
    logged_in_client.put(
        f"{SHEETS_URL}/{ficha['id']}",
        json={
            "nombre": ficha["nombre"],
            "impuesto_id": ficha["impuesto_id"],
            "precio_venta": "25000",
            "insumos": [{"item_id": gel["id"], "cantidad": "5"}],
        },
        headers=_csrf_headers(logged_in_client),
    )

    logged_in_client.post(f"{URL}/{recibo['id']}/cancel", headers=_csrf_headers(logged_in_client))

    # Se devuelven los 2 que realmente se descontaron, no los 5 de la ficha nueva
    assert _existencias(logged_in_client, gel["id"]) == Decimal("10")


def test_cannot_delete_a_sheet_that_is_in_a_receipt_even_if_canceled(logged_in_client, session):
    cliente_id = _create_cliente(logged_in_client)
    gel = _gel(logged_in_client, session)
    ficha = _create_sheet(logged_in_client, session, [(gel, 1)])
    recibo = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas_fichas=[{"ficha_tecnica_id": ficha["id"], "cantidad": "1"}],
    ).json()

    en_recibo = logged_in_client.delete(
        f"{SHEETS_URL}/{ficha['id']}", headers=_csrf_headers(logged_in_client)
    )
    logged_in_client.post(f"{URL}/{recibo['id']}/cancel", headers=_csrf_headers(logged_in_client))
    anulado = logged_in_client.delete(
        f"{SHEETS_URL}/{ficha['id']}", headers=_csrf_headers(logged_in_client)
    )

    assert en_recibo.status_code == 422
    assert "recibo" in en_recibo.json()["message"]
    assert anulado.status_code == 422


def _credit_receipt(logged_in_client, session, cantidad="3") -> dict:
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session, cantidad_inicial="10")
    return logged_in_client.post(
        URL,
        json={
            "tercero_id": cliente_id,
            "condicion": "credito",
            "fecha_vencimiento": "2026-12-01",
            "lineas": [{"item_id": item["id"], "cantidad": cantidad}],
        },
        headers=_csrf_headers(logged_in_client),
    ).json()


def test_cancel_credit_receipt_reverts_stock_and_leaves_accounts_receivable(
    logged_in_client, session
):
    recibo = _credit_receipt(logged_in_client, session)
    assert [r["id"] for r in logged_in_client.get(f"{URL}/accounts-receivable").json()] == [
        recibo["id"]
    ]

    response = logged_in_client.post(
        f"{URL}/{recibo['id']}/cancel", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "anulado"
    existencias = {p["nombre"]: p["existencias"] for p in logged_in_client.get(ITEMS_URL).json()}
    assert existencias["Pan"] == "10.0000"
    # Un recibo anulado deja de ser una cuenta por cobrar
    assert logged_in_client.get(f"{URL}/accounts-receivable").json() == []


def test_cancel_credit_receipt_cancels_every_payment(logged_in_client, session):
    recibo = _credit_receipt(logged_in_client, session)
    empresa_id = session.exec(select(Company)).first().id
    # Todavia no hay abonos en la API (historia 6): se crean directo para probar la regla
    for monto in ("5000", "2000"):
        session.add(
            AccountReceivablePayment(
                empresa_id=empresa_id,
                recibo_id=recibo["id"],
                monto=Decimal(monto),
                fecha=date.today(),
            )
        )
    session.flush()

    logged_in_client.post(f"{URL}/{recibo['id']}/cancel", headers=_csrf_headers(logged_in_client))

    pagos = session.exec(
        select(AccountReceivablePayment).where(AccountReceivablePayment.recibo_id == recibo["id"])
    ).all()
    assert len(pagos) == 2  # no se borran
    assert {pago.estado for pago in pagos} == {"anulado"}


def test_a_receipt_and_its_cancellation_save_each_user_as_author_of_the_stock_movements(
    logged_in_client, session, log_in_as_other_admin
):
    cliente_id = _create_cliente(logged_in_client)
    item = _create_item(logged_in_client, session, cantidad_inicial="10")
    johan = session.exec(select(User.id).where(User.email == EMAIL)).one()
    # Johan crea a María (Admin) y la sesión pasa a ser la de ella: ella hace la venta.
    maria = log_in_as_other_admin(logged_in_client)
    recibo = logged_in_client.post(
        URL,
        json={"tercero_id": cliente_id, "lineas": [{"item_id": item["id"], "cantidad": "3"}]},
        headers=_csrf_headers(logged_in_client),
    ).json()

    # Johan vuelve a entrar y cancela el recibo de María.
    logged_in_client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})
    logged_in_client.post(
        f"{URL}/{recibo['id']}/cancel", headers=_csrf_headers(logged_in_client)
    )

    movimientos = session.exec(
        select(InventoryMovement)
        .where(InventoryMovement.item_id == item["id"])
        .order_by(InventoryMovement.id)
    ).all()
    # Cantidad inicial (Johan), salida de la venta (María) y entrada de la cancelación (Johan).
    assert [(m.tipo, m.created_by_id) for m in movimientos] == [
        ("entrada", johan),
        ("salida", maria),
        ("entrada", johan),
    ]


def _receipt_rows(session, receipt_id: int):
    """El recibo y todas sus líneas (de productos y de fichas), para revisar su auditoría."""
    recibo = session.exec(select(Receipt).where(Receipt.id == receipt_id)).one()
    items = session.exec(
        select(ReceiptItemLine).where(ReceiptItemLine.recibo_id == receipt_id)
    ).all()
    fichas = session.exec(
        select(ReceiptSheetLine).where(ReceiptSheetLine.recibo_id == receipt_id)
    ).all()
    return recibo, list(items), list(fichas)


def _receipt_with_item_and_sheet(logged_in_client, session) -> dict:
    cliente_id = _create_cliente(logged_in_client)
    pan = _create_item(logged_in_client, session, cantidad_inicial="10")
    gel = _gel(logged_in_client, session)
    ficha = _create_sheet(logged_in_client, session, [(gel, "0.5")])
    response = _post_receipt(
        logged_in_client,
        cliente_id,
        lineas=[{"item_id": pan["id"], "cantidad": "2"}],
        lineas_fichas=[{"ficha_tecnica_id": ficha["id"], "cantidad": "1"}],
    )
    assert response.status_code == 201, response.json()
    return response.json()


def test_creating_a_receipt_saves_the_user_as_author_of_the_receipt_and_all_its_lines(
    logged_in_client, session
):
    creado = _receipt_with_item_and_sheet(logged_in_client, session)

    johan = session.exec(select(User.id).where(User.email == EMAIL)).one()
    recibo, items, fichas = _receipt_rows(session, creado["id"])
    assert len(items) == 1 and len(fichas) == 1
    for fila in (recibo, *items, *fichas):
        assert fila.created_by_id == johan
        assert fila.updated_by_id == johan
        assert fila.created_at == fila.updated_at


def test_cancelling_a_receipt_saves_the_canceller_as_updated_by_and_leaves_its_lines_untouched(
    logged_in_client, session, log_in_as_other_admin
):
    creado = _receipt_with_item_and_sheet(logged_in_client, session)
    johan = session.exec(select(User.id).where(User.email == EMAIL)).one()
    maria = log_in_as_other_admin(logged_in_client)

    response = logged_in_client.post(
        f"{URL}/{creado['id']}/cancel", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 200
    recibo, items, fichas = _receipt_rows(session, creado["id"])
    assert recibo.created_by_id == johan
    assert recibo.updated_by_id == maria
    assert recibo.updated_at > recibo.created_at
    # Cancelar no toca las líneas: siguen como las dejó Johan.
    for linea in (*items, *fichas):
        assert linea.updated_by_id == johan
        assert linea.updated_at == linea.created_at


def test_cancelling_a_credit_receipt_saves_the_canceller_as_updated_by(
    logged_in_client, session, log_in_as_other_admin
):
    creado = _credit_receipt(logged_in_client, session)
    johan = session.exec(select(User.id).where(User.email == EMAIL)).one()
    maria = log_in_as_other_admin(logged_in_client)

    response = logged_in_client.post(
        f"{URL}/{creado['id']}/cancel", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 200
    recibo, _, _ = _receipt_rows(session, creado["id"])
    assert recibo.condicion == "credito"
    assert recibo.created_by_id == johan
    assert recibo.updated_by_id == maria
    assert recibo.updated_at > recibo.created_at
