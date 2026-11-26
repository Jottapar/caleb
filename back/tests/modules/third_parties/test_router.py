import pytest
from sqlmodel import select

from app.core.mixins import utc_now
from app.modules.banks.models import Bank
from app.modules.companies.models import Company
from app.modules.third_parties import service as third_parties_service
from app.modules.third_parties.models import ThirdParty, ThirdPartyBankAccount
from app.modules.third_parties.schemas import ThirdPartyCreate
from app.modules.users.models import User
from tests.modules.third_parties.conftest import EMAIL

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


def test_create_third_party_rejects_type_ambos(logged_in_client):
    # "ambos" ya no existe: quien es cliente y proveedor se registra dos veces.
    response = logged_in_client.post(
        URL, json=_payload(tipo="ambos"), headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["message"] == "Tipo de tercero invalido: ambos"


def test_same_person_can_be_registered_as_client_and_supplier(logged_in_client):
    cliente = _create(logged_in_client, tipo="cliente", documento="900123")
    proveedor = _create(logged_in_client, tipo="proveedor", documento="900123")

    assert cliente["id"] != proveedor["id"]
    tipos = sorted(tercero["tipo"] for tercero in logged_in_client.get(URL).json())
    assert tipos == ["cliente", "proveedor"]


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


@pytest.mark.parametrize("email", ["carlos", "carlos@", "carlos@dominio", "car los@dominio.com"])
def test_create_third_party_rejects_invalid_email(logged_in_client, email):
    response = logged_in_client.post(
        URL, json=_payload(email=email), headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["message"] == "El correo no tiene un formato válido"


@pytest.mark.parametrize("telefono", ["300 123 4567", "300-1234567", "+573001234567", "abc"])
def test_create_third_party_rejects_phone_with_non_digits(logged_in_client, telefono):
    response = logged_in_client.post(
        URL, json=_payload(telefono=telefono), headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["message"] == "El teléfono solo puede tener números"


@pytest.mark.parametrize("numero_cuenta", ["0123-4567", "12 34", "ABC123"])
def test_create_third_party_rejects_account_number_with_non_digits(
    logged_in_client, bank, numero_cuenta
):
    response = logged_in_client.post(
        URL,
        json=_payload(
            cuenta_bancaria={
                "banco_id": bank.id,
                "tipo_cuenta": "ahorros",
                "numero_cuenta": numero_cuenta,
            }
        ),
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["message"] == "El número de cuenta solo puede tener números"


def test_create_third_party_accepts_account_number_with_20_digits(logged_in_client, bank):
    body = _create(
        logged_in_client,
        cuenta_bancaria={"banco_id": bank.id, "tipo_cuenta": "ahorros", "numero_cuenta": "1" * 20},
    )

    assert body["cuenta_bancaria"]["numero_cuenta"] == "1" * 20


def test_create_third_party_rejects_account_number_with_more_than_20_digits(
    logged_in_client, bank
):
    response = logged_in_client.post(
        URL,
        json=_payload(
            cuenta_bancaria={"banco_id": bank.id, "tipo_cuenta": "ahorros", "numero_cuenta": "1" * 21}
        ),
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["message"] == "El número de cuenta no puede tener más de 20 dígitos"


# ---------- editar ----------


def test_update_third_party_returns_200_and_updated_data(logged_in_client):
    created = _create(logged_in_client)

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"nombre": "Carlos Actualizado", "direccion": "Carrera 9"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["nombre"] == "Carlos Actualizado"
    assert body["direccion"] == "Carrera 9"


def test_update_third_party_accepts_same_type(logged_in_client):
    # El formulario de editar manda todos los campos, tipo incluido: el mismo tipo no es un cambio.
    created = _create(logged_in_client, tipo="proveedor")

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"tipo": "proveedor", "nombre": "Carlos Actualizado"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["tipo"] == "proveedor"


def test_update_third_party_rejects_type_change(logged_in_client):
    created = _create(logged_in_client, tipo="cliente")

    response = logged_in_client.patch(
        f"{URL}/{created['id']}", json={"tipo": "proveedor"}, headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 422
    assert response.json()["message"] == "El tipo de un tercero no se puede cambiar"
    listed = logged_in_client.get(URL).json()
    assert listed[0]["tipo"] == "cliente"


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


def test_update_deleted_third_party_returns_404(logged_in_client):
    created = _create(logged_in_client)
    logged_in_client.delete(f"{URL}/{created['id']}", headers=_csrf_headers(logged_in_client))

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"nombre": "Otro nombre"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404


def test_delete_already_deleted_third_party_returns_404(logged_in_client):
    created = _create(logged_in_client)
    logged_in_client.delete(f"{URL}/{created['id']}", headers=_csrf_headers(logged_in_client))

    response = logged_in_client.delete(
        f"{URL}/{created['id']}", headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 404


def test_deleting_a_third_party_saves_deleted_at_and_the_user_as_deleted_by(
    logged_in_client, session
):
    created = _create(logged_in_client)

    logged_in_client.delete(f"{URL}/{created['id']}", headers=_csrf_headers(logged_in_client))

    fila = _third_party_row(session, created["id"])
    assert fila.deleted_at is not None
    assert fila.deleted_by_id == _user_id(session, EMAIL)


# ---------- soft eliminados ----------


def _soft_delete(logged_in_client, third_party_id: int) -> None:
    response = logged_in_client.delete(
        f"{URL}/{third_party_id}", headers=_csrf_headers(logged_in_client)
    )
    assert response.status_code == 204


def test_list_deleted_third_parties_returns_only_deleted_ones_of_current_company(
    logged_in_client, session
):
    eliminado = _create(logged_in_client, nombre="Carlos")
    proveedor_eliminado = _create(logged_in_client, nombre="Luis", tipo="proveedor")
    _create(logged_in_client, nombre="Ana")
    _soft_delete(logged_in_client, eliminado["id"])
    _soft_delete(logged_in_client, proveedor_eliminado["id"])
    # Uno soft eliminado de otra empresa: no debe salir.
    ajeno = session.get(ThirdParty, _create_in_other_company(session))
    ajeno.deleted_at = utc_now()
    session.flush()

    response = logged_in_client.get(f"{URL}/deleted")

    assert response.status_code == 200
    assert {tercero["nombre"] for tercero in response.json()} == {"Carlos", "Luis"}


def test_list_deleted_third_parties_returns_empty_list_when_none_deleted(logged_in_client):
    _create(logged_in_client, nombre="Ana")

    response = logged_in_client.get(f"{URL}/deleted")

    assert response.status_code == 200
    assert response.json() == []


def _restore(logged_in_client, third_party_id: int):
    return logged_in_client.post(
        f"{URL}/{third_party_id}/restore", headers=_csrf_headers(logged_in_client)
    )


def test_restore_third_party_returns_200_and_it_appears_again_in_the_list(logged_in_client):
    created = _create(logged_in_client, nombre="Carlos")
    _soft_delete(logged_in_client, created["id"])

    response = _restore(logged_in_client, created["id"])

    assert response.status_code == 200
    assert response.json()["nombre"] == "Carlos"
    nombres = [tercero["nombre"] for tercero in logged_in_client.get(URL).json()]
    assert "Carlos" in nombres
    assert logged_in_client.get(f"{URL}/deleted").json() == []


def test_restore_third_party_clears_deleted_at_and_deleted_by(logged_in_client, session):
    created = _create(logged_in_client)
    _soft_delete(logged_in_client, created["id"])

    _restore(logged_in_client, created["id"])

    fila = _third_party_row(session, created["id"])
    assert fila.deleted_at is None
    assert fila.deleted_by_id is None


def test_restore_third_party_keeps_its_activo_value(logged_in_client):
    created = _create(logged_in_client)
    logged_in_client.patch(
        f"{URL}/{created['id']}", json={"activo": False}, headers=_csrf_headers(logged_in_client)
    )
    _soft_delete(logged_in_client, created["id"])

    response = _restore(logged_in_client, created["id"])

    assert response.json()["activo"] is False


def test_restore_third_party_that_is_not_deleted_returns_404(logged_in_client):
    created = _create(logged_in_client)

    response = _restore(logged_in_client, created["id"])

    assert response.status_code == 404


def test_restore_third_party_from_other_company_returns_404(logged_in_client, session):
    ajeno = session.get(ThirdParty, _create_in_other_company(session))
    ajeno.deleted_at = utc_now()
    session.flush()

    response = _restore(logged_in_client, ajeno.id)

    assert response.status_code == 404


CUENTA = {"tipo_cuenta": "ahorros", "numero_cuenta": "0123456789"}


def _user_id(session, email: str) -> int:
    return session.exec(select(User.id).where(User.email == email)).one()


def _third_party_row(session, third_party_id: int) -> ThirdParty:
    return session.exec(select(ThirdParty).where(ThirdParty.id == third_party_id)).one()


def _account_rows(session, third_party_id: int) -> list[ThirdPartyBankAccount]:
    return list(
        session.exec(
            select(ThirdPartyBankAccount).where(ThirdPartyBankAccount.tercero_id == third_party_id)
        ).all()
    )


def test_creating_a_third_party_saves_the_user_as_author_of_the_third_party_and_its_bank_account(
    logged_in_client, session, bank
):
    creado = _create(logged_in_client, cuenta_bancaria={"banco_id": bank.id, **CUENTA})

    johan = _user_id(session, EMAIL)
    filas = [_third_party_row(session, creado["id"]), *_account_rows(session, creado["id"])]
    assert len(filas) == 2
    for fila in filas:
        assert fila.created_by_id == johan
        assert fila.updated_by_id == johan
        assert fila.created_at == fila.updated_at


def test_editing_a_third_party_saves_the_editor_as_updated_by_and_keeps_the_creator(
    logged_in_client, session, log_in_as_other_admin
):
    creado = _create(logged_in_client)
    johan = _user_id(session, EMAIL)
    maria = log_in_as_other_admin(logged_in_client)

    response = logged_in_client.patch(
        f"{URL}/{creado['id']}",
        json={"nombre": "Carlos Gómez"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    fila = _third_party_row(session, creado["id"])
    assert fila.created_by_id == johan
    assert fila.updated_by_id == maria
    assert fila.updated_at > fila.created_at


def test_changing_only_the_bank_account_counts_as_editing_the_third_party(
    logged_in_client, session, bank, log_in_as_other_admin
):
    creado = _create(logged_in_client, cuenta_bancaria={"banco_id": bank.id, **CUENTA})
    johan = _user_id(session, EMAIL)
    maria = log_in_as_other_admin(logged_in_client)

    # Solo viene la cuenta: ningún dato del tercero cambia.
    response = logged_in_client.patch(
        f"{URL}/{creado['id']}",
        json={"cuenta_bancaria": {"banco_id": bank.id, "tipo_cuenta": "corriente", "numero_cuenta": "999"}},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    fila = _third_party_row(session, creado["id"])
    assert fila.created_by_id == johan
    assert fila.updated_by_id == maria
    assert fila.updated_at > fila.created_at
    # La cuenta vieja se reemplazó: la nueva es una fila nueva, creada por quien hizo el cambio.
    cuentas = _account_rows(session, creado["id"])
    assert [cuenta.numero_cuenta for cuenta in cuentas] == ["999"]
    assert cuentas[0].created_by_id == maria
    assert cuentas[0].updated_by_id == maria


def test_removing_the_bank_account_counts_as_editing_the_third_party(
    logged_in_client, session, bank, log_in_as_other_admin
):
    creado = _create(logged_in_client, cuenta_bancaria={"banco_id": bank.id, **CUENTA})
    johan = _user_id(session, EMAIL)
    maria = log_in_as_other_admin(logged_in_client)

    response = logged_in_client.patch(
        f"{URL}/{creado['id']}",
        json={"cuenta_bancaria": None},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    fila = _third_party_row(session, creado["id"])
    assert fila.created_by_id == johan
    assert fila.updated_by_id == maria
    assert fila.updated_at > fila.created_at
    assert _account_rows(session, creado["id"]) == []
