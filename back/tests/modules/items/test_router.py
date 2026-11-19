from sqlmodel import select

from app.modules.companies.models import Company
from app.modules.items import service as items_service
from app.modules.taxes.models import Tax

URL = "/api/v1/items"


def _csrf_headers(logged_in_client):
    return {"X-CSRF-TOKEN": logged_in_client.cookies.get("csrf_access_token")}


def _sin_impuesto_id(session) -> int:
    empresa = session.exec(select(Company).where(Company.nombre == "Panadería Luna")).one()
    return session.exec(
        select(Tax).where(Tax.nombre == "Sin impuesto", Tax.empresa_id == empresa.id)
    ).one().id


def test_create_item_returns_201_and_saved_data(logged_in_client, session):
    response = logged_in_client.post(
        URL,
        json={
            "codigo": "HAR-001",
            "nombre": "Harina de trigo",
            "costo": "2000",
            "precio_venta": "3500",
            "impuesto_id": _sin_impuesto_id(session),
        },
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["codigo"] == "HAR-001"
    assert body["nombre"] == "Harina de trigo"
    assert body["costo"] == "2000.00"
    assert body["precio_venta"] == "3500.00"
    assert body["activo"] is True


def test_create_item_without_code_generates_one(logged_in_client, session):
    response = logged_in_client.post(
        URL,
        json={"nombre": "Harina de trigo", "impuesto_id": _sin_impuesto_id(session)},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 201
    assert response.json()["codigo"] != ""


def test_create_item_rejects_duplicate_code(logged_in_client, session):
    impuesto_id = _sin_impuesto_id(session)
    logged_in_client.post(
        URL,
        json={"codigo": "HAR-001", "nombre": "Harina", "impuesto_id": impuesto_id},
        headers=_csrf_headers(logged_in_client),
    )

    response = logged_in_client.post(
        URL,
        json={"codigo": "HAR-001", "nombre": "Harina de trigo", "impuesto_id": impuesto_id},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_item_with_initial_quantity_shows_in_stock(logged_in_client, session):
    response = logged_in_client.post(
        URL,
        json={
            "nombre": "Harina de trigo",
            "impuesto_id": _sin_impuesto_id(session),
            "cantidad_inicial": "10",
        },
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 201
    assert response.json()["existencias"] == "10.0000"


def test_create_item_without_initial_quantity_has_zero_stock(logged_in_client, session):
    response = logged_in_client.post(
        URL,
        json={"nombre": "Harina de trigo", "impuesto_id": _sin_impuesto_id(session)},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 201
    assert response.json()["existencias"] == "0"


def test_create_item_appears_in_list_with_company_data(logged_in_client, session):
    logged_in_client.post(
        URL,
        json={
            "codigo": "HAR-001",
            "nombre": "Harina de trigo",
            "costo": "2000",
            "precio_venta": "3500",
            "impuesto_id": _sin_impuesto_id(session),
            "cantidad_inicial": "5",
        },
        headers=_csrf_headers(logged_in_client),
    )

    response = logged_in_client.get(URL)

    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    item = items[0]
    assert item["codigo"] == "HAR-001"
    assert item["nombre"] == "Harina de trigo"
    assert item["costo"] == "2000.00"
    assert item["precio_venta"] == "3500.00"
    assert item["existencias"] == "5.0000"


def test_list_items_only_returns_current_company(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    items_service.create_item(
        session,
        empresa_id=otra_empresa.id,
        nombre="Item Ajeno",
        impuesto_id=otro_impuesto.id,
    )
    logged_in_client.post(
        URL,
        json={"nombre": "Item Propio", "impuesto_id": _sin_impuesto_id(session)},
        headers=_csrf_headers(logged_in_client),
    )

    response = logged_in_client.get(URL)

    nombres = [item["nombre"] for item in response.json()]
    assert "Item Propio" in nombres
    assert "Item Ajeno" not in nombres


def test_create_item_requires_authentication(client):
    response = client.post(URL, json={"nombre": "Harina", "impuesto_id": 1})

    assert response.status_code == 401


def test_create_item_rejects_unknown_tax(logged_in_client):
    response = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": 99999},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_item_rejects_both_se_vende_and_es_insumo_false(logged_in_client, session):
    response = logged_in_client.post(
        URL,
        json={
            "nombre": "Harina",
            "impuesto_id": _sin_impuesto_id(session),
            "se_vende": False,
            "es_insumo": False,
        },
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_update_item_returns_200_and_updated_data(logged_in_client, session):
    impuesto_id = _sin_impuesto_id(session)
    created = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": impuesto_id},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"nombre": "Harina de trigo", "costo": "2500", "precio_venta": "4000"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["nombre"] == "Harina de trigo"
    assert body["costo"] == "2500.00"
    assert body["precio_venta"] == "4000.00"


def test_update_item_rejects_unknown_tax(logged_in_client, session):
    created = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": _sin_impuesto_id(session)},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"impuesto_id": 99999},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_update_item_from_other_company_returns_404(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno = items_service.create_item(
        session, empresa_id=otra_empresa.id, nombre="Item Ajeno", impuesto_id=otro_impuesto.id
    )

    response = logged_in_client.patch(
        f"{URL}/{ajeno.id}",
        json={"nombre": "Intento de cambio"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404


def test_bulk_add_stock_increases_existencias_for_each_line(logged_in_client, session):
    impuesto_id = _sin_impuesto_id(session)
    harina = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": impuesto_id, "cantidad_inicial": "5"},
        headers=_csrf_headers(logged_in_client),
    ).json()
    azucar = logged_in_client.post(
        URL,
        json={"nombre": "Azúcar", "impuesto_id": impuesto_id},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.post(
        f"{URL}/stock-movements/bulk",
        json={
            "lineas": [
                {"item_id": harina["id"], "cantidad": "3"},
                {"item_id": azucar["id"], "cantidad": "2"},
            ]
        },
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    existencias = {item["nombre"]: item["existencias"] for item in logged_in_client.get(URL).json()}
    assert existencias["Harina"] == "8.0000"
    assert existencias["Azúcar"] == "2.0000"


def test_bulk_add_stock_rejects_if_any_line_invalid_and_applies_nothing(logged_in_client, session):
    impuesto_id = _sin_impuesto_id(session)
    harina = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": impuesto_id},
        headers=_csrf_headers(logged_in_client),
    ).json()
    azucar = logged_in_client.post(
        URL,
        json={"nombre": "Azúcar", "impuesto_id": impuesto_id},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.post(
        f"{URL}/stock-movements/bulk",
        json={
            "lineas": [
                {"item_id": harina["id"], "cantidad": "3"},
                {"item_id": azucar["id"], "cantidad": "-1"},
            ]
        },
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"
    existencias = {item["nombre"]: item["existencias"] for item in logged_in_client.get(URL).json()}
    assert existencias["Harina"] == "0"
    assert existencias["Azúcar"] == "0"


def test_bulk_add_stock_item_from_other_company_rejects_all(logged_in_client, session):
    impuesto_id = _sin_impuesto_id(session)
    harina = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": impuesto_id},
        headers=_csrf_headers(logged_in_client),
    ).json()
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno = items_service.create_item(
        session, empresa_id=otra_empresa.id, nombre="Item Ajeno", impuesto_id=otro_impuesto.id
    )

    response = logged_in_client.post(
        f"{URL}/stock-movements/bulk",
        json={
            "lineas": [
                {"item_id": harina["id"], "cantidad": "3"},
                {"item_id": ajeno.id, "cantidad": "2"},
            ]
        },
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404
    existencias = {item["nombre"]: item["existencias"] for item in logged_in_client.get(URL).json()}
    assert existencias["Harina"] == "0"


def test_add_stock_increases_existencias(logged_in_client, session):
    created = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": _sin_impuesto_id(session), "cantidad_inicial": "5"},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.post(
        f"{URL}/{created['id']}/stock-movements",
        json={"cantidad": "3"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["existencias"] == "8.0000"


def test_add_stock_rejects_zero_or_negative_quantity(logged_in_client, session):
    created = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": _sin_impuesto_id(session)},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.post(
        f"{URL}/{created['id']}/stock-movements",
        json={"cantidad": "-1"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"
    assert logged_in_client.get(URL).json()[0]["existencias"] == "0"


def test_add_stock_from_other_company_returns_404(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno = items_service.create_item(
        session, empresa_id=otra_empresa.id, nombre="Item Ajeno", impuesto_id=otro_impuesto.id
    )

    response = logged_in_client.post(
        f"{URL}/{ajeno.id}/stock-movements",
        json={"cantidad": "3"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404


def test_delete_item_returns_204_and_removes_it(logged_in_client, session):
    created = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": _sin_impuesto_id(session)},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.delete(
        f"{URL}/{created['id']}", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 204
    nombres = [item["nombre"] for item in logged_in_client.get(URL).json()]
    assert "Harina" not in nombres


def test_delete_item_from_other_company_returns_404(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra_empresa.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno = items_service.create_item(
        session, empresa_id=otra_empresa.id, nombre="Item Ajeno", impuesto_id=otro_impuesto.id
    )

    response = logged_in_client.delete(
        f"{URL}/{ajeno.id}", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 404


def test_delete_item_with_movements_rejects_deletion(logged_in_client, session):
    created = logged_in_client.post(
        URL,
        json={
            "nombre": "Harina",
            "impuesto_id": _sin_impuesto_id(session),
            "cantidad_inicial": "5",
        },
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.delete(
        f"{URL}/{created['id']}", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"
    nombres = [item["nombre"] for item in logged_in_client.get(URL).json()]
    assert "Harina" in nombres


def test_update_item_can_deactivate(logged_in_client, session):
    created = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": _sin_impuesto_id(session)},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"activo": False},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["activo"] is False


def test_update_item_can_reactivate(logged_in_client, session):
    created = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": _sin_impuesto_id(session)},
        headers=_csrf_headers(logged_in_client),
    ).json()
    logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"activo": False},
        headers=_csrf_headers(logged_in_client),
    )

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"activo": True},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["activo"] is True


def test_update_item_only_changes_sent_fields(logged_in_client, session):
    impuesto_id = _sin_impuesto_id(session)
    created = logged_in_client.post(
        URL,
        json={"codigo": "HAR-001", "nombre": "Harina", "costo": "2000", "impuesto_id": impuesto_id},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"nombre": "Harina de trigo"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["nombre"] == "Harina de trigo"
    assert body["codigo"] == "HAR-001"
    assert body["costo"] == "2000.00"


def test_update_item_rejects_empty_name(logged_in_client, session):
    created = logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": _sin_impuesto_id(session)},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"nombre": "   "},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def _create_item(logged_in_client, session, **extra):
    response = logged_in_client.post(
        URL,
        json={"impuesto_id": _sin_impuesto_id(session), **extra},
        headers=_csrf_headers(logged_in_client),
    )
    assert response.status_code == 201
    return response.json()


def test_update_item_can_change_code(logged_in_client, session):
    created = _create_item(logged_in_client, session, nombre="Harina", codigo="HAR-001")

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"codigo": "HAR-002"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["codigo"] == "HAR-002"


def test_update_item_keeping_its_own_code_is_not_a_duplicate(logged_in_client, session):
    created = _create_item(logged_in_client, session, nombre="Harina", codigo="HAR-001")

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"nombre": "Harina de trigo", "codigo": "HAR-001"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200


def test_update_item_rejects_code_used_by_another_item(logged_in_client, session):
    _create_item(logged_in_client, session, nombre="Harina", codigo="HAR-001")
    azucar = _create_item(logged_in_client, session, nombre="Azucar", codigo="AZU-001")

    response = logged_in_client.patch(
        f"{URL}/{azucar['id']}",
        json={"codigo": "HAR-001"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_update_item_rejects_empty_code(logged_in_client, session):
    created = _create_item(logged_in_client, session, nombre="Harina", codigo="HAR-001")

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"codigo": "   "},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_update_item_can_change_se_vende_and_es_insumo(logged_in_client, session):
    created = _create_item(logged_in_client, session, nombre="Harina")

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"se_vende": False, "es_insumo": True},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["se_vende"] is False
    assert response.json()["es_insumo"] is True


def test_update_item_rejects_leaving_both_marks_false(logged_in_client, session):
    # El producto nace con se_vende=true y es_insumo=false: apagar solo se_vende deja los dos en falso
    created = _create_item(logged_in_client, session, nombre="Harina")

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"se_vende": False},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_item_code_does_not_repeat_after_deleting_one_from_the_middle(
    logged_in_client, session
):
    impuesto_id = _sin_impuesto_id(session)
    creados = [
        logged_in_client.post(
            URL,
            json={"nombre": nombre, "impuesto_id": impuesto_id},
            headers=_csrf_headers(logged_in_client),
        ).json()
        for nombre in ("A", "B", "C")
    ]
    assert [c["codigo"] for c in creados] == ["P-0001", "P-0002", "P-0003"]
    logged_in_client.delete(f"{URL}/{creados[0]['id']}", headers=_csrf_headers(logged_in_client))

    nuevo = logged_in_client.post(
        URL, json={"nombre": "D", "impuesto_id": impuesto_id}, headers=_csrf_headers(logged_in_client)
    ).json()

    assert nuevo["codigo"] == "P-0004"


def test_create_item_code_ignores_codes_written_by_hand(logged_in_client, session):
    impuesto_id = _sin_impuesto_id(session)
    logged_in_client.post(
        URL,
        json={"nombre": "Harina", "impuesto_id": impuesto_id, "codigo": "HAR-001"},
        headers=_csrf_headers(logged_in_client),
    )

    nuevo = logged_in_client.post(
        URL, json={"nombre": "Pan", "impuesto_id": impuesto_id}, headers=_csrf_headers(logged_in_client)
    ).json()

    assert nuevo["codigo"] == "P-0001"


def test_item_reports_whether_it_has_movements(logged_in_client, session):
    impuesto_id = _sin_impuesto_id(session)
    headers = _csrf_headers(logged_in_client)
    sin = logged_in_client.post(
        URL, json={"nombre": "Sin stock", "impuesto_id": impuesto_id}, headers=headers
    ).json()
    con = logged_in_client.post(
        URL,
        json={"nombre": "Con stock", "impuesto_id": impuesto_id, "cantidad_inicial": "5"},
        headers=headers,
    ).json()

    assert sin["tiene_movimientos"] is False
    assert con["tiene_movimientos"] is True
    listados = {i["nombre"]: i["tiene_movimientos"] for i in logged_in_client.get(URL).json()}
    assert listados == {"Sin stock": False, "Con stock": True}


def test_item_gets_movements_after_adding_stock(logged_in_client, session):
    headers = _csrf_headers(logged_in_client)
    creado = logged_in_client.post(
        URL, json={"nombre": "Harina", "impuesto_id": _sin_impuesto_id(session)}, headers=headers
    ).json()

    actualizado = logged_in_client.post(
        f"{URL}/{creado['id']}/stock-movements", json={"cantidad": "3"}, headers=headers
    ).json()

    assert actualizado["tiene_movimientos"] is True
