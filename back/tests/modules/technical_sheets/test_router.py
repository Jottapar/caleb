from decimal import Decimal

from sqlmodel import select

from app.modules.companies.models import Company
from app.modules.items import service as items_service
from app.modules.services import service as services_service
from app.modules.services.schemas import ServiceCreate
from app.modules.taxes.models import Tax
from app.modules.technical_sheets.models import (
    TechnicalSheet,
    TechnicalSheetItemLine,
    TechnicalSheetServiceLine,
)
from app.modules.users.models import User
from tests.modules.technical_sheets.conftest import EMAIL

URL = "/api/v1/technical-sheets"


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


def _servicio(session, nombre="Corte de pelo", costo=8000):
    return services_service.create_service(
        session, _empresa(session).id, ServiceCreate(nombre=nombre, costo=Decimal(costo))
    )


def _post(logged_in_client, session, **overrides):
    body = {
        "nombre": "Corte de pelo para hombre",
        "impuesto_id": _sin_impuesto_id(session),
        "precio_venta": "25000",
    }
    body.update(overrides)
    return logged_in_client.post(URL, json=body, headers=_csrf_headers(logged_in_client))


def test_create_sheet_returns_201_with_code_and_cost_from_supplies_and_services(
    logged_in_client, session
):
    gel = _insumo(session, "Gel", 1000)
    corte = _servicio(session, costo=8000)

    response = _post(
        logged_in_client,
        session,
        insumos=[{"item_id": gel.id, "cantidad": "0.1"}],
        servicios=[{"servicio_id": corte.id, "cantidad": "1"}],
    )

    assert response.status_code == 201
    body = response.json()
    assert body["codigo"] == "F-0001"
    assert body["nombre"] == "Corte de pelo para hombre"
    assert body["precio_venta"] == "25000.00"
    # 0,1 x 1000 + 1 x 8000
    assert body["costo"] == "8100.00"
    assert [i["nombre"] for i in body["insumos"]] == ["Gel"]
    assert [s["nombre"] for s in body["servicios"]] == ["Corte de pelo"]


def test_create_sheet_service_quantity_defaults_to_one(logged_in_client, session):
    corte = _servicio(session, costo=8000)

    response = _post(logged_in_client, session, servicios=[{"servicio_id": corte.id}])

    assert response.status_code == 201
    assert response.json()["servicios"][0]["cantidad"] == "1.0000"
    assert response.json()["costo"] == "8000.00"


def test_create_sheet_accepts_only_a_service_without_supplies(logged_in_client, session):
    asesoria = _servicio(session, nombre="Asesoria", costo=5000)

    response = _post(logged_in_client, session, servicios=[{"servicio_id": asesoria.id}])

    assert response.status_code == 201
    assert response.json()["insumos"] == []


def test_create_sheet_codes_are_consecutive(logged_in_client, session):
    corte = _servicio(session)
    _post(logged_in_client, session, servicios=[{"servicio_id": corte.id}])

    response = _post(
        logged_in_client, session, nombre="Otro", servicios=[{"servicio_id": corte.id}]
    )

    assert response.json()["codigo"] == "F-0002"


def test_sheet_cost_follows_the_current_cost_of_supplies_and_services(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)
    corte = _servicio(session, costo=8000)
    _post(
        logged_in_client,
        session,
        insumos=[{"item_id": gel.id, "cantidad": "2"}],
        servicios=[{"servicio_id": corte.id, "cantidad": "1"}],
    )

    logged_in_client.patch(
        f"/api/v1/items/{gel.id}", json={"costo": "1500"}, headers=_csrf_headers(logged_in_client)
    )
    corte.costo = Decimal(9000)
    session.add(corte)
    session.flush()
    response = logged_in_client.get(URL)

    # 2 x 1500 + 1 x 9000
    assert response.json()[0]["costo"] == "12000.00"


def test_create_sheet_accepts_supply_that_is_also_sold(logged_in_client, session):
    agua = _insumo(session, "Agua", 800, es_insumo=True, se_vende=True)

    response = _post(logged_in_client, session, insumos=[{"item_id": agua.id, "cantidad": "1"}])

    assert response.status_code == 201


def test_create_sheet_rejects_item_that_is_not_a_supply(logged_in_client, session):
    pan = _insumo(session, "Pan", 300, es_insumo=False, se_vende=True)

    response = _post(logged_in_client, session, insumos=[{"item_id": pan.id, "cantidad": "1"}])

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_sheet_rejects_without_any_line(logged_in_client, session):
    response = _post(logged_in_client, session, insumos=[], servicios=[])

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_sheet_rejects_repeated_supply(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)

    response = _post(
        logged_in_client,
        session,
        insumos=[{"item_id": gel.id, "cantidad": "1"}, {"item_id": gel.id, "cantidad": "2"}],
    )

    assert response.status_code == 422


def test_create_sheet_rejects_repeated_service(logged_in_client, session):
    corte = _servicio(session)

    response = _post(
        logged_in_client,
        session,
        servicios=[
            {"servicio_id": corte.id, "cantidad": "1"},
            {"servicio_id": corte.id, "cantidad": "2"},
        ],
    )

    assert response.status_code == 422


def test_create_sheet_rejects_zero_quantity_in_supply(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)

    response = _post(logged_in_client, session, insumos=[{"item_id": gel.id, "cantidad": "0"}])

    assert response.status_code == 422


def test_create_sheet_rejects_zero_quantity_in_service(logged_in_client, session):
    corte = _servicio(session)

    response = _post(
        logged_in_client, session, servicios=[{"servicio_id": corte.id, "cantidad": "0"}]
    )

    assert response.status_code == 422


def test_create_sheet_rejects_empty_name(logged_in_client, session):
    corte = _servicio(session)

    response = _post(
        logged_in_client, session, nombre="  ", servicios=[{"servicio_id": corte.id}]
    )

    assert response.status_code == 422


def test_create_sheet_rejects_supply_from_another_company(logged_in_client, session):
    otra = Company(nombre="Otra empresa")
    session.add(otra)
    session.flush()
    session.add(Tax(empresa_id=otra.id, nombre="Sin impuesto", porcentaje=0))
    session.flush()
    ajeno = items_service.create_item(
        session,
        empresa_id=otra.id,
        nombre="Gel ajeno",
        impuesto_id=session.exec(select(Tax).where(Tax.empresa_id == otra.id)).one().id,
        se_vende=False,
        es_insumo=True,
    )

    response = _post(logged_in_client, session, insumos=[{"item_id": ajeno.id, "cantidad": "1"}])

    assert response.status_code == 422


def test_create_sheet_rejects_service_from_another_company(logged_in_client, session):
    otra = Company(nombre="Otra empresa")
    session.add(otra)
    session.flush()
    ajeno = services_service.create_service(
        session, otra.id, ServiceCreate(nombre="Servicio ajeno", costo=Decimal(100))
    )

    response = _post(logged_in_client, session, servicios=[{"servicio_id": ajeno.id}])

    assert response.status_code == 422


def test_create_sheet_does_not_touch_supply_stock(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)

    _post(logged_in_client, session, insumos=[{"item_id": gel.id, "cantidad": "2"}])
    items = logged_in_client.get("/api/v1/items").json()

    assert Decimal(items[0]["existencias"]) == 0


def test_list_sheets_requires_authentication(client):
    response = client.get(URL)

    assert response.status_code == 401


def _put(logged_in_client, session, sheet_id, **overrides):
    body = {
        "nombre": "Corte editado",
        "impuesto_id": _sin_impuesto_id(session),
        "precio_venta": "30000",
    }
    body.update(overrides)
    return logged_in_client.put(
        f"{URL}/{sheet_id}", json=body, headers=_csrf_headers(logged_in_client)
    )


def test_update_sheet_changes_header_and_replaces_all_lines(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)
    cera = _insumo(session, "Cera", 2000)
    corte = _servicio(session, costo=8000)
    lavado = _servicio(session, nombre="Lavado", costo=3000)
    creada = _post(
        logged_in_client,
        session,
        insumos=[{"item_id": gel.id, "cantidad": "0.1"}],
        servicios=[{"servicio_id": corte.id, "cantidad": "1"}],
    ).json()

    response = _put(
        logged_in_client,
        session,
        creada["id"],
        insumos=[{"item_id": cera.id, "cantidad": "2"}],
        servicios=[{"servicio_id": lavado.id, "cantidad": "1"}],
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == creada["id"]
    assert body["codigo"] == "F-0001"  # el codigo no cambia
    assert body["nombre"] == "Corte editado"
    assert body["precio_venta"] == "30000.00"
    assert [i["nombre"] for i in body["insumos"]] == ["Cera"]
    assert [s["nombre"] for s in body["servicios"]] == ["Lavado"]
    # 2 x 2000 + 1 x 3000: las lineas viejas ya no cuentan
    assert body["costo"] == "7000.00"


def test_update_sheet_can_remove_all_supplies_if_a_service_remains(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)
    corte = _servicio(session)
    creada = _post(
        logged_in_client,
        session,
        insumos=[{"item_id": gel.id, "cantidad": "1"}],
        servicios=[{"servicio_id": corte.id}],
    ).json()

    response = _put(
        logged_in_client, session, creada["id"], servicios=[{"servicio_id": corte.id}]
    )

    assert response.status_code == 200
    assert response.json()["insumos"] == []


def test_update_sheet_rejects_without_any_line_and_keeps_the_old_ones(logged_in_client, session):
    corte = _servicio(session)
    creada = _post(logged_in_client, session, servicios=[{"servicio_id": corte.id}]).json()

    response = _put(logged_in_client, session, creada["id"])

    assert response.status_code == 422
    listadas = logged_in_client.get(URL).json()
    assert [s["nombre"] for s in listadas[0]["servicios"]] == ["Corte de pelo"]


def test_update_sheet_rejects_repeated_supply(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)
    creada = _post(
        logged_in_client, session, insumos=[{"item_id": gel.id, "cantidad": "1"}]
    ).json()

    response = _put(
        logged_in_client,
        session,
        creada["id"],
        insumos=[{"item_id": gel.id, "cantidad": "1"}, {"item_id": gel.id, "cantidad": "2"}],
    )

    assert response.status_code == 422


def test_update_sheet_rejects_empty_name(logged_in_client, session):
    corte = _servicio(session)
    creada = _post(logged_in_client, session, servicios=[{"servicio_id": corte.id}]).json()

    response = _put(
        logged_in_client,
        session,
        creada["id"],
        nombre="  ",
        servicios=[{"servicio_id": corte.id}],
    )

    assert response.status_code == 422


def test_update_sheet_returns_404_if_it_does_not_exist(logged_in_client, session):
    corte = _servicio(session)

    response = _put(logged_in_client, session, 999, servicios=[{"servicio_id": corte.id}])

    assert response.status_code == 404


def test_update_sheet_requires_authentication(client):
    response = client.put(f"{URL}/1", json={})

    assert response.status_code == 401


def test_deactivate_and_reactivate_sheet(logged_in_client, session):
    corte = _servicio(session)
    creada = _post(logged_in_client, session, servicios=[{"servicio_id": corte.id}]).json()
    headers = _csrf_headers(logged_in_client)

    off = logged_in_client.patch(f"{URL}/{creada['id']}", json={"activo": False}, headers=headers)
    on = logged_in_client.patch(f"{URL}/{creada['id']}", json={"activo": True}, headers=headers)

    assert off.status_code == 200
    assert off.json()["activo"] is False
    # Desactivar no toca nada mas: las lineas siguen ahi
    assert [s["nombre"] for s in off.json()["servicios"]] == ["Corte de pelo"]
    assert on.json()["activo"] is True


def test_set_active_returns_404_if_it_does_not_exist(logged_in_client):
    response = logged_in_client.patch(
        f"{URL}/999", json={"activo": False}, headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 404


def test_delete_sheet_returns_204_and_removes_it_with_its_lines(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)
    corte = _servicio(session)
    creada = _post(
        logged_in_client,
        session,
        insumos=[{"item_id": gel.id, "cantidad": "1"}],
        servicios=[{"servicio_id": corte.id}],
    ).json()

    response = logged_in_client.delete(
        f"{URL}/{creada['id']}", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 204
    assert logged_in_client.get(URL).json() == []
    # El insumo y el servicio son del catalogo: siguen existiendo
    assert [i["nombre"] for i in logged_in_client.get("/api/v1/items").json()] == ["Gel"]
    assert [s["nombre"] for s in logged_in_client.get("/api/v1/services").json()] == [
        "Corte de pelo"
    ]


def test_delete_sheet_from_other_company_returns_404(logged_in_client, session):
    otra = Company(nombre="Otra empresa")
    session.add(otra)
    session.flush()
    otro_impuesto = Tax(empresa_id=otra.id, nombre="Sin impuesto", porcentaje=0)
    session.add(otro_impuesto)
    session.flush()
    ajeno_servicio = services_service.create_service(
        session, otra.id, ServiceCreate(nombre="Ajeno", costo=Decimal(1))
    )
    from app.modules.technical_sheets import service as sheets_service
    from app.modules.technical_sheets.schemas import (
        SheetServiceLineCreate,
        TechnicalSheetCreate,
    )

    ajena = sheets_service.create_technical_sheet(
        session,
        otra.id,
        TechnicalSheetCreate(
            nombre="Ficha ajena",
            impuesto_id=otro_impuesto.id,
            servicios=[SheetServiceLineCreate(servicio_id=ajeno_servicio.id)],
        ),
    )

    response = logged_in_client.delete(
        f"{URL}/{ajena.id}", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 404


def test_delete_sheet_returns_404_if_it_does_not_exist(logged_in_client):
    response = logged_in_client.delete(f"{URL}/999", headers=_csrf_headers(logged_in_client))

    assert response.status_code == 404


def _desactivar_item(logged_in_client, item_id):
    return logged_in_client.patch(
        f"/api/v1/items/{item_id}",
        json={"activo": False},
        headers=_csrf_headers(logged_in_client),
    )


def test_cannot_deactivate_supply_used_by_an_active_sheet(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)
    _post(logged_in_client, session, insumos=[{"item_id": gel.id, "cantidad": "1"}])

    response = _desactivar_item(logged_in_client, gel.id)

    assert response.status_code == 422
    assert response.json()["message"] == (
        "No se puede desactivar Gel porque la ficha tecnica "
        "Corte de pelo para hombre lo esta utilizando"
    )
    items = logged_in_client.get("/api/v1/items").json()
    assert items[0]["activo"] is True


def test_deactivate_error_names_every_active_sheet_using_the_supply(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)
    linea = [{"item_id": gel.id, "cantidad": "1"}]
    _post(logged_in_client, session, nombre="Corte B", insumos=linea)
    _post(logged_in_client, session, nombre="Corte A", insumos=linea)

    response = _desactivar_item(logged_in_client, gel.id)

    assert response.status_code == 422
    assert "Corte A, Corte B" in response.json()["message"]


def test_can_deactivate_supply_when_its_sheets_are_inactive(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)
    creada = _post(
        logged_in_client, session, insumos=[{"item_id": gel.id, "cantidad": "1"}]
    ).json()
    logged_in_client.patch(
        f"{URL}/{creada['id']}", json={"activo": False}, headers=_csrf_headers(logged_in_client)
    )

    response = _desactivar_item(logged_in_client, gel.id)

    assert response.status_code == 200
    assert response.json()["activo"] is False


def test_can_deactivate_item_that_no_sheet_uses(logged_in_client, session):
    gel = _insumo(session, "Gel", 1000)

    response = _desactivar_item(logged_in_client, gel.id)

    assert response.status_code == 200


def test_sheet_code_does_not_repeat_after_deleting_one_from_the_middle(logged_in_client, session):
    corte = _servicio(session)
    linea = [{"servicio_id": corte.id}]
    creadas = [
        _post(logged_in_client, session, nombre=nombre, servicios=linea).json()
        for nombre in ("A", "B", "C")
    ]
    assert [c["codigo"] for c in creadas] == ["F-0001", "F-0002", "F-0003"]
    logged_in_client.delete(
        f"{URL}/{creadas[0]['id']}", headers=_csrf_headers(logged_in_client)
    )

    nueva = _post(logged_in_client, session, nombre="D", servicios=linea).json()

    assert nueva["codigo"] == "F-0004"


def _user_id(session, email: str) -> int:
    return session.exec(select(User.id).where(User.email == email)).one()


def _sheet_rows(session, sheet_id: int):
    """La ficha y todas sus líneas (insumos y mano de obra), para revisar su auditoría."""
    ficha = session.exec(select(TechnicalSheet).where(TechnicalSheet.id == sheet_id)).one()
    insumos = session.exec(
        select(TechnicalSheetItemLine).where(TechnicalSheetItemLine.ficha_tecnica_id == sheet_id)
    ).all()
    servicios = session.exec(
        select(TechnicalSheetServiceLine).where(
            TechnicalSheetServiceLine.ficha_tecnica_id == sheet_id
        )
    ).all()
    return ficha, list(insumos), list(servicios)


def test_creating_a_sheet_saves_the_user_as_author_of_the_sheet_and_all_its_lines(
    logged_in_client, session
):
    gel = _insumo(session, "Gel", 1000)
    corte = _servicio(session)
    creada = _post(
        logged_in_client,
        session,
        insumos=[{"item_id": gel.id, "cantidad": "0.1"}],
        servicios=[{"servicio_id": corte.id, "cantidad": "1"}],
    ).json()

    johan = _user_id(session, EMAIL)
    ficha, insumos, servicios = _sheet_rows(session, creada["id"])
    assert len(insumos) == 1 and len(servicios) == 1
    for fila in (ficha, *insumos, *servicios):
        assert fila.created_by_id == johan
        assert fila.updated_by_id == johan
        assert fila.created_at == fila.updated_at


def test_editing_a_sheet_saves_the_editor_as_updated_by_and_keeps_the_creator(
    logged_in_client, session, log_in_as_other_admin
):
    gel = _insumo(session, "Gel", 1000)
    cera = _insumo(session, "Cera", 2000)
    corte = _servicio(session)
    creada = _post(
        logged_in_client,
        session,
        insumos=[{"item_id": gel.id, "cantidad": "0.1"}],
        servicios=[{"servicio_id": corte.id, "cantidad": "1"}],
    ).json()
    johan = _user_id(session, EMAIL)
    maria = log_in_as_other_admin(logged_in_client)

    response = _put(
        logged_in_client,
        session,
        creada["id"],
        insumos=[{"item_id": cera.id, "cantidad": "2"}],
        servicios=[{"servicio_id": corte.id, "cantidad": "1"}],
    )

    assert response.status_code == 200
    ficha, insumos, servicios = _sheet_rows(session, creada["id"])
    assert ficha.created_by_id == johan
    assert ficha.updated_by_id == maria
    assert ficha.updated_at > ficha.created_at
    # Las líneas se reemplazan: las nuevas son filas nuevas, creadas por quien editó.
    for linea in (*insumos, *servicios):
        assert linea.created_by_id == maria
        assert linea.updated_by_id == maria


def test_editing_only_the_lines_of_a_sheet_counts_as_editing_the_sheet(
    logged_in_client, session, log_in_as_other_admin
):
    gel = _insumo(session, "Gel", 1000)
    cera = _insumo(session, "Cera", 2000)
    corte = _servicio(session)
    creada = _post(
        logged_in_client,
        session,
        insumos=[{"item_id": gel.id, "cantidad": "0.1"}],
        servicios=[{"servicio_id": corte.id, "cantidad": "1"}],
    ).json()
    johan = _user_id(session, EMAIL)
    maria = log_in_as_other_admin(logged_in_client)

    # Mismo nombre, precio e impuesto que al crearla: solo cambia el insumo.
    response = _put(
        logged_in_client,
        session,
        creada["id"],
        nombre="Corte de pelo para hombre",
        precio_venta="25000",
        insumos=[{"item_id": cera.id, "cantidad": "2"}],
        servicios=[{"servicio_id": corte.id, "cantidad": "1"}],
    )

    assert response.status_code == 200
    ficha, _, _ = _sheet_rows(session, creada["id"])
    assert ficha.created_by_id == johan
    assert ficha.updated_by_id == maria
    assert ficha.updated_at > ficha.created_at


def test_saving_a_sheet_with_the_same_data_still_counts_as_an_edit(
    logged_in_client, session, log_in_as_other_admin
):
    gel = _insumo(session, "Gel", 1000)
    corte = _servicio(session)
    lineas = {
        "insumos": [{"item_id": gel.id, "cantidad": "0.1"}],
        "servicios": [{"servicio_id": corte.id, "cantidad": "1"}],
    }
    creada = _post(logged_in_client, session, **lineas).json()
    johan = _user_id(session, EMAIL)
    maria = log_in_as_other_admin(logged_in_client)

    # Nada cambia: mismo nombre, precio, impuesto y líneas que al crearla.
    response = _put(
        logged_in_client,
        session,
        creada["id"],
        nombre="Corte de pelo para hombre",
        precio_venta="25000",
        **lineas,
    )

    assert response.status_code == 200
    ficha, _, _ = _sheet_rows(session, creada["id"])
    assert ficha.created_by_id == johan
    assert ficha.updated_by_id == maria
    assert ficha.updated_at > ficha.created_at


def test_activating_or_deactivating_a_sheet_counts_as_editing_it(
    logged_in_client, session, log_in_as_other_admin
):
    gel = _insumo(session, "Gel", 1000)
    creada = _post(
        logged_in_client, session, insumos=[{"item_id": gel.id, "cantidad": "0.1"}]
    ).json()
    johan = _user_id(session, EMAIL)
    maria = log_in_as_other_admin(logged_in_client)

    response = logged_in_client.patch(
        f"{URL}/{creada['id']}", json={"activo": False}, headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 200
    ficha, insumos, _ = _sheet_rows(session, creada["id"])
    assert ficha.created_by_id == johan
    assert ficha.updated_by_id == maria
    assert ficha.updated_at > ficha.created_at
    # Activar o desactivar no toca las líneas: siguen como las dejó Johan.
    assert [linea.updated_by_id for linea in insumos] == [johan]
