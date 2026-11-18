from decimal import Decimal

from sqlmodel import select

from app.modules.companies.models import Company
from app.modules.items import service as items_service
from app.modules.taxes.models import Tax

URL = "/api/v1/services"


def _csrf_headers(logged_in_client):
    return {"X-CSRF-TOKEN": logged_in_client.cookies.get("csrf_access_token")}


def _empresa(session) -> Company:
    return session.exec(select(Company).where(Company.nombre == "Panadería Luna")).one()


def _sin_impuesto_id(session) -> int:
    empresa = _empresa(session)
    return session.exec(
        select(Tax).where(Tax.nombre == "Sin impuesto", Tax.empresa_id == empresa.id)
    ).one().id


def _insumo(session, nombre, costo, es_insumo=True, se_vende=False, empresa_id=None):
    return items_service.create_item(
        session,
        empresa_id=empresa_id or _empresa(session).id,
        nombre=nombre,
        impuesto_id=_sin_impuesto_id(session),
        costo=costo,
        se_vende=se_vende,
        es_insumo=es_insumo,
    )


def _post(logged_in_client, session, **overrides):
    body = {"nombre": "Corte de pelo", "impuesto_id": _sin_impuesto_id(session), "precio_venta": "25000"}
    body.update(overrides)
    return logged_in_client.post(URL, json=body, headers=_csrf_headers(logged_in_client))


def test_create_service_returns_201_with_generated_code_and_calculated_cost(logged_in_client, session):
    shampoo = _insumo(session, "Shampoo", 1000)
    toalla = _insumo(session, "Toalla desechable", 500)

    response = _post(
        logged_in_client,
        session,
        insumos=[
            {"item_id": shampoo.id, "cantidad": "2"},
            {"item_id": toalla.id, "cantidad": "1"},
        ],
    )

    assert response.status_code == 201
    body = response.json()
    assert body["codigo"] == "S-0001"
    assert body["nombre"] == "Corte de pelo"
    assert body["precio_venta"] == "25000.00"
    # 2 x 1000 + 1 x 500
    assert body["costo"] == "2500.00"
    assert [insumo["nombre"] for insumo in body["insumos"]] == ["Shampoo", "Toalla desechable"]


def test_create_service_codes_are_consecutive(logged_in_client, session):
    shampoo = _insumo(session, "Shampoo", 1000)
    _post(logged_in_client, session, insumos=[{"item_id": shampoo.id, "cantidad": "1"}])

    response = _post(
        logged_in_client, session, nombre="Lavado", insumos=[{"item_id": shampoo.id, "cantidad": "1"}]
    )

    assert response.json()["codigo"] == "S-0002"


def test_service_cost_follows_the_current_cost_of_its_supplies(logged_in_client, session):
    shampoo = _insumo(session, "Shampoo", 1000)
    _post(logged_in_client, session, insumos=[{"item_id": shampoo.id, "cantidad": "2"}])

    logged_in_client.patch(
        f"/api/v1/items/{shampoo.id}", json={"costo": "1500"}, headers=_csrf_headers(logged_in_client)
    )
    response = logged_in_client.get(URL)

    assert response.json()[0]["costo"] == "3000.00"


def test_create_service_accepts_supply_that_is_also_sold(logged_in_client, session):
    agua = _insumo(session, "Agua", 800, es_insumo=True, se_vende=True)

    response = _post(logged_in_client, session, insumos=[{"item_id": agua.id, "cantidad": "1"}])

    assert response.status_code == 201


def test_create_service_rejects_item_that_is_not_a_supply(logged_in_client, session):
    pan = _insumo(session, "Pan", 300, es_insumo=False, se_vende=True)

    response = _post(logged_in_client, session, insumos=[{"item_id": pan.id, "cantidad": "1"}])

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_service_rejects_without_supplies(logged_in_client, session):
    response = _post(logged_in_client, session, insumos=[])

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_service_rejects_repeated_supply(logged_in_client, session):
    shampoo = _insumo(session, "Shampoo", 1000)

    response = _post(
        logged_in_client,
        session,
        insumos=[{"item_id": shampoo.id, "cantidad": "1"}, {"item_id": shampoo.id, "cantidad": "2"}],
    )

    assert response.status_code == 422


def test_create_service_rejects_zero_quantity(logged_in_client, session):
    shampoo = _insumo(session, "Shampoo", 1000)

    response = _post(logged_in_client, session, insumos=[{"item_id": shampoo.id, "cantidad": "0"}])

    assert response.status_code == 422


def test_create_service_rejects_empty_name(logged_in_client, session):
    shampoo = _insumo(session, "Shampoo", 1000)

    response = _post(
        logged_in_client, session, nombre="  ", insumos=[{"item_id": shampoo.id, "cantidad": "1"}]
    )

    assert response.status_code == 422


def test_create_service_rejects_supply_from_another_company(logged_in_client, session):
    otra = Company(nombre="Otra empresa")
    session.add(otra)
    session.flush()
    session.add(Tax(empresa_id=otra.id, nombre="Sin impuesto", porcentaje=0))
    session.flush()
    ajeno = items_service.create_item(
        session,
        empresa_id=otra.id,
        nombre="Shampoo ajeno",
        impuesto_id=session.exec(select(Tax).where(Tax.empresa_id == otra.id)).one().id,
        se_vende=False,
        es_insumo=True,
    )

    response = _post(logged_in_client, session, insumos=[{"item_id": ajeno.id, "cantidad": "1"}])

    assert response.status_code == 422


def test_create_service_does_not_touch_supply_stock(logged_in_client, session):
    shampoo = _insumo(session, "Shampoo", 1000)

    _post(logged_in_client, session, insumos=[{"item_id": shampoo.id, "cantidad": "2"}])
    items = logged_in_client.get("/api/v1/items").json()

    assert Decimal(items[0]["existencias"]) == 0


def test_list_services_requires_authentication(client):
    response = client.get(URL)

    assert response.status_code == 401
