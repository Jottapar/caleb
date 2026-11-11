from datetime import date
from decimal import Decimal

from sqlmodel import select

from app.modules.companies.models import Company
from app.modules.items import service as items_service
from app.modules.receipts import service as receipts_service
from app.modules.receipts.models import AccountReceivablePayment
from app.modules.receipts.schemas import ReceiptItemLineCreate
from app.modules.taxes.models import Tax
from app.modules.third_parties import service as third_parties_service

URL = "/api/v1/receipts"
ITEMS_URL = "/api/v1/items"
THIRD_PARTIES_URL = "/api/v1/third-parties"


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
        json={"tipo": "cliente", "nombre": "Cliente de prueba"},
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
        session, empresa_id=otra_empresa.id, tipo="cliente", nombre="Cliente Ajeno"
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
        json={"tipo": "proveedor", "nombre": "Proveedor de prueba"},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.post(
        URL,
        json={"tercero_id": proveedor["id"], "lineas": [{"item_id": item["id"], "cantidad": "1"}]},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


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
        session, empresa_id=otra_empresa.id, tipo="cliente", nombre="Cliente Ajeno"
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
        session, empresa_id=otra_empresa.id, tipo="cliente", nombre="Cliente Ajeno"
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
        session, empresa_id=otra_empresa.id, tipo="cliente", nombre="Cliente Ajeno"
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
