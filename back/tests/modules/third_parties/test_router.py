import pytest

from app.modules.banks.models import Bank
from app.modules.companies.models import Company
from app.modules.third_parties import service as third_parties_service
from app.modules.third_parties.models import ThirdParty
from app.modules.third_parties.schemas import ThirdPartyCreate

URL = "/api/v1/third-parties"


def _csrf_headers(logged_in_client):
    return {"X-CSRF-TOKEN": logged_in_client.cookies.get("csrf_access_token")}


def _payload(**overrides) -> dict:
    """Un tercero valido, con todos los campos obligatorios; cada test cambia lo que prueba."""
    return {
        "tipo": "cliente",
        "nombre": "Carlos",
        "documento": "123",
        "email": "carlos@example.com",
        "telefono": "3001234567",
        "direccion": "Calle 1 # 2-3",
        **overrides,
    }


def _create(logged_in_client, **overrides) -> dict:
    response = logged_in_client.post(
        URL, json=_payload(**overrides), headers=_csrf_headers(logged_in_client)
    )
    assert response.status_code == 201, response.json()
    return response.json()


def _create_in_other_company(session) -> int:
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    ajeno = third_parties_service.create_third_party(
        session, otra_empresa.id, ThirdPartyCreate(**_payload(nombre="Tercero Ajeno"))
    )
    return ajeno.id


@pytest.fixture
def bank(session) -> Bank:
    # Los tests crean las tablas con create_all, sin la migracion que carga los bancos.
    bank = Bank(nombre="Bancolombia")
    session.add(bank)
    session.flush()
    return bank


@pytest.fixture
def inactive_bank(session) -> Bank:
    bank = Bank(nombre="Banco Cerrado", activo=False)
    session.add(bank)
    session.flush()
    return bank


# ---------- crear ----------


def test_create_third_party_returns_201_and_saved_data(logged_in_client):
    body = _create(logged_in_client, nombre="Ana Pérez", email="ana@example.com")

    assert body["tipo"] == "cliente"
    assert body["nombre"] == "Ana Pérez"
    assert body["documento"] == "123"
    assert body["email"] == "ana@example.com"
    assert body["telefono"] == "3001234567"
    assert body["direccion"] == "Calle 1 # 2-3"
    assert body["activo"] is True
    assert body["cuenta_bancaria"] is None


def test_create_third_party_appears_in_list(logged_in_client):
    _create(logged_in_client, tipo="proveedor", nombre="Insumos SAS")

    response = logged_in_client.get(URL)

    assert response.status_code == 200
    nombres = [tercero["nombre"] for tercero in response.json()]
    assert "Insumos SAS" in nombres


def test_list_third_parties_only_returns_current_company(logged_in_client, session):
    _create_in_other_company(session)
    _create(logged_in_client, nombre="Tercero Propio")

    response = logged_in_client.get(URL)

    nombres = [tercero["nombre"] for tercero in response.json()]
    assert "Tercero Propio" in nombres
    assert "Tercero Ajeno" not in nombres


def test_create_third_party_rejects_invalid_type(logged_in_client):
    response = logged_in_client.post(
        URL, json=_payload(tipo="socio"), headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


@pytest.mark.parametrize("campo", ["nombre", "documento", "email", "telefono", "direccion"])
def test_create_third_party_rejects_empty_required_field(logged_in_client, campo):
    response = logged_in_client.post(
        URL, json=_payload(**{campo: "   "}), headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


@pytest.mark.parametrize("campo", ["documento", "email", "telefono", "direccion"])
def test_create_third_party_rejects_missing_required_field(logged_in_client, campo):
    payload = _payload()
    del payload[campo]

    response = logged_in_client.post(URL, json=payload, headers=_csrf_headers(logged_in_client))

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_third_party_requires_authentication(client):
    response = client.post(URL, json=_payload())

    assert response.status_code == 401


# ---------- cuenta bancaria al crear ----------


def test_create_provider_with_bank_account_returns_it(logged_in_client, bank):
    body = _create(
        logged_in_client,
        tipo="proveedor",
        cuenta_bancaria={"banco_id": bank.id, "tipo_cuenta": "ahorros", "numero_cuenta": "0123456789"},
    )

    assert body["cuenta_bancaria"] == {
        "banco_id": bank.id,
        "banco_nombre": "Bancolombia",
        "tipo_cuenta": "ahorros",
        "numero_cuenta": "0123456789",
    }


def test_create_third_party_without_bank_account_is_allowed_for_provider(logged_in_client):
    body = _create(logged_in_client, tipo="proveedor")

    assert body["cuenta_bancaria"] is None


def test_create_third_party_rejects_invalid_account_type(logged_in_client, bank):
    response = logged_in_client.post(
        URL,
        json=_payload(
            cuenta_bancaria={"banco_id": bank.id, "tipo_cuenta": "nomina", "numero_cuenta": "123"}
        ),
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_third_party_rejects_empty_account_number(logged_in_client, bank):
    response = logged_in_client.post(
        URL,
        json=_payload(
            cuenta_bancaria={"banco_id": bank.id, "tipo_cuenta": "ahorros", "numero_cuenta": "  "}
        ),
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_third_party_rejects_incomplete_bank_account(logged_in_client, bank):
    response = logged_in_client.post(
        URL,
        json=_payload(cuenta_bancaria={"banco_id": bank.id}),
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422


def test_create_third_party_rejects_unknown_bank(logged_in_client):
    response = logged_in_client.post(
        URL,
        json=_payload(
            cuenta_bancaria={"banco_id": 999999, "tipo_cuenta": "ahorros", "numero_cuenta": "123"}
        ),
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404


def test_create_third_party_rejects_inactive_bank(logged_in_client, inactive_bank):
    response = logged_in_client.post(
        URL,
        json=_payload(
            cuenta_bancaria={
                "banco_id": inactive_bank.id,
                "tipo_cuenta": "ahorros",
                "numero_cuenta": "123",
            }
        ),
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404


# ---------- editar ----------


def test_update_third_party_returns_200_and_updated_data(logged_in_client):
    created = _create(logged_in_client)

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"tipo": "proveedor", "nombre": "Carlos Actualizado", "direccion": "Carrera 9"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tipo"] == "proveedor"
    assert body["nombre"] == "Carlos Actualizado"
    assert body["direccion"] == "Carrera 9"


def test_update_third_party_only_changes_sent_fields(logged_in_client):
    created = _create(logged_in_client, documento="999")

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"nombre": "Carlos Actualizado"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["nombre"] == "Carlos Actualizado"
    assert body["documento"] == "999"


def test_update_third_party_rejects_invalid_type(logged_in_client):
    created = _create(logged_in_client)

    response = logged_in_client.patch(
        f"{URL}/{created['id']}", json={"tipo": "socio"}, headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


@pytest.mark.parametrize("campo", ["nombre", "documento", "email", "telefono", "direccion"])
def test_update_third_party_rejects_empty_required_field(logged_in_client, campo):
    created = _create(logged_in_client)

    response = logged_in_client.patch(
        f"{URL}/{created['id']}", json={campo: "   "}, headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_update_old_third_party_with_empty_fields_requires_completing_them(
    logged_in_client, session
):
    # Un tercero creado antes de la regla, con direccion vacia en la base.
    created = _create(logged_in_client)
    tercero = session.get(ThirdParty, created["id"])
    tercero.direccion = ""
    session.add(tercero)
    session.flush()

    sin_completar = logged_in_client.patch(
        f"{URL}/{created['id']}", json={"nombre": "Otro"}, headers=_csrf_headers(logged_in_client)
    )
    completando = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"nombre": "Otro", "direccion": "Calle 5"},
        headers=_csrf_headers(logged_in_client),
    )

    assert sin_completar.status_code == 422
    assert completando.status_code == 200


def test_update_third_party_from_other_company_returns_404(logged_in_client, session):
    ajeno_id = _create_in_other_company(session)

    response = logged_in_client.patch(
        f"{URL}/{ajeno_id}",
        json={"nombre": "Intento de cambio"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404


def test_update_third_party_can_deactivate(logged_in_client):
    created = _create(logged_in_client)

    response = logged_in_client.patch(
        f"{URL}/{created['id']}", json={"activo": False}, headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 200
    assert response.json()["activo"] is False


def test_update_third_party_can_reactivate(logged_in_client):
    created = _create(logged_in_client)
    logged_in_client.patch(
        f"{URL}/{created['id']}", json={"activo": False}, headers=_csrf_headers(logged_in_client)
    )

    response = logged_in_client.patch(
        f"{URL}/{created['id']}", json={"activo": True}, headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 200
    assert response.json()["activo"] is True


# ---------- cuenta bancaria al editar ----------


def test_update_third_party_adds_bank_account(logged_in_client, bank):
    created = _create(logged_in_client, tipo="proveedor")

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"cuenta_bancaria": {"banco_id": bank.id, "tipo_cuenta": "corriente", "numero_cuenta": "555"}},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["cuenta_bancaria"]["numero_cuenta"] == "555"
    assert response.json()["cuenta_bancaria"]["tipo_cuenta"] == "corriente"


def test_update_third_party_replaces_bank_account(logged_in_client, bank):
    created = _create(
        logged_in_client,
        tipo="proveedor",
        cuenta_bancaria={"banco_id": bank.id, "tipo_cuenta": "ahorros", "numero_cuenta": "111"},
    )

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"cuenta_bancaria": {"banco_id": bank.id, "tipo_cuenta": "ahorros", "numero_cuenta": "222"}},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["cuenta_bancaria"]["numero_cuenta"] == "222"


def test_update_third_party_with_null_removes_bank_account(logged_in_client, bank):
    created = _create(
        logged_in_client,
        tipo="proveedor",
        cuenta_bancaria={"banco_id": bank.id, "tipo_cuenta": "ahorros", "numero_cuenta": "111"},
    )

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"cuenta_bancaria": None},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["cuenta_bancaria"] is None


def test_update_third_party_without_bank_field_keeps_bank_account(logged_in_client, bank):
    created = _create(
        logged_in_client,
        tipo="proveedor",
        cuenta_bancaria={"banco_id": bank.id, "tipo_cuenta": "ahorros", "numero_cuenta": "111"},
    )

    response = logged_in_client.patch(
        f"{URL}/{created['id']}", json={"nombre": "Otro"}, headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 200
    assert response.json()["cuenta_bancaria"]["numero_cuenta"] == "111"


# ---------- borrar ----------


def test_delete_third_party_returns_204_and_removes_it(logged_in_client):
    created = _create(logged_in_client)

    response = logged_in_client.delete(
        f"{URL}/{created['id']}", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 204
    nombres = [tercero["nombre"] for tercero in logged_in_client.get(URL).json()]
    assert "Carlos" not in nombres


def test_delete_third_party_with_bank_account_returns_204(logged_in_client, bank):
    created = _create(
        logged_in_client,
        tipo="proveedor",
        cuenta_bancaria={"banco_id": bank.id, "tipo_cuenta": "ahorros", "numero_cuenta": "111"},
    )

    response = logged_in_client.delete(
        f"{URL}/{created['id']}", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 204


def test_delete_third_party_from_other_company_returns_404(logged_in_client, session):
    ajeno_id = _create_in_other_company(session)

    response = logged_in_client.delete(f"{URL}/{ajeno_id}", headers=_csrf_headers(logged_in_client))

    assert response.status_code == 404
