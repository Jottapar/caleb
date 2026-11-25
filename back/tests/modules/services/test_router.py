from sqlmodel import select

from app.modules.companies.models import Company
from app.modules.services.models import Service
from app.modules.users.models import User
from tests.modules.services.conftest import EMAIL

URL = "/api/v1/services"


def _csrf_headers(logged_in_client):
    return {"X-CSRF-TOKEN": logged_in_client.cookies.get("csrf_access_token")}


def _post(logged_in_client, **overrides):
    body = {"nombre": "Corte de pelo", "costo": "8000"}
    body.update(overrides)
    return logged_in_client.post(URL, json=body, headers=_csrf_headers(logged_in_client))


def test_create_service_returns_201_with_generated_code(logged_in_client):
    response = _post(logged_in_client)

    assert response.status_code == 201
    assert response.json() == {
        "id": response.json()["id"],
        "codigo": "S-0001",
        "nombre": "Corte de pelo",
        "costo": "8000.00",
        "activo": True,
    }


def test_create_service_codes_are_consecutive(logged_in_client):
    _post(logged_in_client)

    response = _post(logged_in_client, nombre="Lavado")

    assert response.json()["codigo"] == "S-0002"


def test_create_service_without_cost_defaults_to_zero(logged_in_client):
    response = logged_in_client.post(
        URL, json={"nombre": "Asesoria"}, headers=_csrf_headers(logged_in_client)
    )

    assert response.status_code == 201
    assert response.json()["costo"] == "0.00"


def test_create_service_rejects_empty_name(logged_in_client):
    response = _post(logged_in_client, nombre="  ")

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_service_rejects_negative_cost(logged_in_client):
    response = _post(logged_in_client, costo="-1")

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_list_services_returns_only_the_company_services(logged_in_client, session):
    _post(logged_in_client, nombre="Corte de pelo")
    otra = Company(nombre="Otra empresa")
    session.add(otra)
    session.flush()
    session.add(Service(empresa_id=otra.id, codigo="S-0001", nombre="Ajeno", costo=1))
    session.flush()

    response = logged_in_client.get(URL)

    assert [s["nombre"] for s in response.json()] == ["Corte de pelo"]


def test_list_services_requires_authentication(client):
    response = client.get(URL)

    assert response.status_code == 401


def test_creating_a_service_saves_the_user_as_author(logged_in_client, session):
    creado = _post(logged_in_client).json()

    johan = session.exec(select(User.id).where(User.email == EMAIL)).one()
    fila = session.exec(select(Service).where(Service.id == creado["id"])).one()
    assert fila.created_by_id == johan
    assert fila.updated_by_id == johan
    assert fila.created_at == fila.updated_at
