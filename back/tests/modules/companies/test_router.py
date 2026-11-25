import pytest
from sqlmodel import select

from app.modules.companies.models import Company
from app.modules.users.models import User

URL = "/api/v1/company"


def _my_company(session) -> Company:
    """La empresa 'Panadería Luna' que crea la fixture `owner`."""
    return session.exec(select(Company).where(Company.nombre == "Panadería Luna")).one()


def _my_company_by_name(session, nombre: str) -> Company:
    return session.exec(select(Company).where(Company.nombre == nombre)).one()


def _csrf_headers(logged_in_client):
    return {"X-CSRF-TOKEN": logged_in_client.cookies.get("csrf_access_token")}


def _patch(logged_in_client, **cambios):
    return logged_in_client.patch(URL, json=cambios, headers=_csrf_headers(logged_in_client))


def test_get_company_returns_my_company_data(logged_in_client, session):
    company = _my_company(session)
    company.documento_fiscal = "9001234567"
    company.direccion = "Calle 1 # 2-3"
    company.telefono = "3001234567"
    company.email = "contacto@luna.com"
    session.flush()

    response = logged_in_client.get(URL)

    assert response.status_code == 200
    assert response.json() == {
        "nombre": "Panadería Luna",
        "documento_fiscal": "9001234567",
        "direccion": "Calle 1 # 2-3",
        "telefono": "3001234567",
        "email": "contacto@luna.com",
    }


def test_get_company_returns_empty_strings_for_unfilled_data(logged_in_client):
    # La empresa recien creada solo tiene nombre.
    response = logged_in_client.get(URL)

    assert response.status_code == 200
    assert response.json() == {
        "nombre": "Panadería Luna",
        "documento_fiscal": "",
        "direccion": "",
        "telefono": "",
        "email": "",
    }


def test_get_company_without_session_returns_401(client):
    response = client.get(URL)

    assert response.status_code == 401


def test_patch_company_with_valid_data_saves_and_returns_it(logged_in_client):
    response = _patch(
        logged_in_client,
        nombre="Panadería Sol",
        documento_fiscal="9007654321",
        direccion="Carrera 5 # 6-7",
        telefono="3109876543",
        email="hola@sol.com",
    )

    esperado = {
        "nombre": "Panadería Sol",
        "documento_fiscal": "9007654321",
        "direccion": "Carrera 5 # 6-7",
        "telefono": "3109876543",
        "email": "hola@sol.com",
    }
    assert response.status_code == 200
    assert response.json() == esperado
    # Y quedo guardado: un GET aparte lo ve igual.
    assert logged_in_client.get(URL).json() == esperado


def test_me_shows_the_new_company_name_after_patch(logged_in_client):
    _patch(logged_in_client, nombre="Panadería Sol")

    response = logged_in_client.get("/api/v1/auth/me")

    assert response.json()["company_name"] == "Panadería Sol"


def test_patch_company_with_one_field_keeps_the_others(logged_in_client):
    _patch(logged_in_client, documento_fiscal="9001234567", telefono="3001234567")

    response = _patch(logged_in_client, direccion="Calle 9 # 8-7")

    assert response.json() == {
        "nombre": "Panadería Luna",
        "documento_fiscal": "9001234567",
        "direccion": "Calle 9 # 8-7",
        "telefono": "3001234567",
        "email": "",
    }


@pytest.mark.parametrize("nombre", ["", "   "])
def test_patch_company_rejects_empty_name_and_changes_nothing(logged_in_client, nombre):
    # Viaja tambien un telefono valido: si se rechaza, ese telefono tampoco se guarda.
    response = _patch(logged_in_client, nombre=nombre, telefono="3001234567")

    assert response.status_code == 422
    assert response.json()["message"] == "El nombre de la empresa es obligatorio"
    assert logged_in_client.get(URL).json() == {
        "nombre": "Panadería Luna",
        "documento_fiscal": "",
        "direccion": "",
        "telefono": "",
        "email": "",
    }


@pytest.mark.parametrize("nit", ["900.123.456-7", "900123456-7", "abc", "900 123"])
def test_patch_company_rejects_nit_that_is_not_only_digits(logged_in_client, nit):
    response = _patch(logged_in_client, documento_fiscal=nit)

    assert response.status_code == 422
    assert response.json()["message"] == "El NIT solo puede tener números"
    assert logged_in_client.get(URL).json()["documento_fiscal"] == ""


@pytest.mark.parametrize("telefono", ["300 123 4567", "+573001234567", "300-123", "abc"])
def test_patch_company_rejects_phone_that_is_not_only_digits(logged_in_client, telefono):
    response = _patch(logged_in_client, telefono=telefono)

    assert response.status_code == 422
    assert response.json()["message"] == "El teléfono solo puede tener números"
    assert logged_in_client.get(URL).json()["telefono"] == ""


@pytest.mark.parametrize("email", ["sinarroba", "a@b", "a b@c.com", "@luna.com"])
def test_patch_company_rejects_email_without_valid_format(logged_in_client, email):
    response = _patch(logged_in_client, email=email)

    assert response.status_code == 422
    assert response.json()["message"] == "El correo no tiene un formato válido"
    assert logged_in_client.get(URL).json()["email"] == ""


def test_patch_company_accepts_empty_optional_fields(logged_in_client):
    _patch(
        logged_in_client,
        documento_fiscal="9001234567",
        direccion="Calle 1",
        telefono="3001234567",
        email="a@luna.com",
    )

    # Quien no tiene el dato a mano puede dejarlo vacio de nuevo.
    response = _patch(logged_in_client, documento_fiscal="", direccion="", telefono="", email="")

    assert response.status_code == 200
    assert response.json() == {
        "nombre": "Panadería Luna",
        "documento_fiscal": "",
        "direccion": "",
        "telefono": "",
        "email": "",
    }


def test_patch_company_never_touches_another_company(logged_in_client, session):
    otra = Company(nombre="Otra Empresa", documento_fiscal="111", telefono="222")
    session.add(otra)
    session.flush()

    _patch(logged_in_client, nombre="Panadería Sol", documento_fiscal="9001234567")

    session.refresh(otra)
    assert otra.nombre == "Otra Empresa"
    assert otra.documento_fiscal == "111"
    assert otra.telefono == "222"
    assert logged_in_client.get(URL).json()["nombre"] == "Panadería Sol"


@pytest.mark.parametrize(
    "campo, valor, mensaje",
    [
        ("nombre", "a" * 151, "El nombre no puede tener más de 150 caracteres"),
        ("documento_fiscal", "1" * 31, "El NIT no puede tener más de 30 caracteres"),
        ("direccion", "a" * 201, "La dirección no puede tener más de 200 caracteres"),
        ("telefono", "3" * 31, "El teléfono no puede tener más de 30 caracteres"),
        ("email", "a" * 143 + "@luna.com", "El correo no puede tener más de 150 caracteres"),
    ],
)
def test_patch_company_rejects_values_longer_than_the_column(
    logged_in_client, campo, valor, mensaje
):
    response = _patch(logged_in_client, **{campo: valor})

    assert response.status_code == 422
    assert response.json()["message"] == mensaje
    assert logged_in_client.get(URL).json()["nombre"] == "Panadería Luna"


@pytest.mark.parametrize("campo", ["documento_fiscal", "direccion", "telefono", "email"])
def test_patch_company_treats_null_in_optional_fields_as_empty(logged_in_client, campo):
    _patch(logged_in_client, documento_fiscal="9001234567", direccion="Calle 1", telefono="300", email="a@luna.com")

    response = _patch(logged_in_client, **{campo: None})

    assert response.status_code == 200
    assert response.json()[campo] == ""


def test_editing_the_company_saves_the_editor_as_updated_by_and_keeps_the_creator(
    logged_in_client, session
):
    admin = session.exec(select(User.id).where(User.email == "johan@example.com")).one()
    caleb = session.exec(select(User.id).where(User.email == "caleb@caleb.com")).one()

    response = _patch(logged_in_client, nombre="Panadería Sol")

    assert response.status_code == 200
    company = _my_company_by_name(session, "Panadería Sol")
    # La empresa la creó la consola (Caleb); quien la editó es el Admin de esta petición.
    assert company.created_by_id == caleb
    assert company.updated_by_id == admin
    assert company.updated_at > company.created_at
