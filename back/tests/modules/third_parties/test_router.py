from app.modules.companies.models import Company
from app.modules.third_parties import service as third_parties_service

URL = "/api/v1/third-parties"


def _csrf_headers(logged_in_client):
    return {"X-CSRF-TOKEN": logged_in_client.cookies.get("csrf_access_token")}


def test_create_third_party_returns_201_and_saved_data(logged_in_client):
    response = logged_in_client.post(
        URL,
        json={
            "tipo": "cliente",
            "nombre": "Ana Pérez",
            "documento": "123",
            "email": "ana@example.com",
            "telefono": "3001234567",
        },
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "cliente"
    assert body["nombre"] == "Ana Pérez"
    assert body["documento"] == "123"
    assert body["email"] == "ana@example.com"
    assert body["telefono"] == "3001234567"
    assert body["activo"] is True


def test_create_third_party_appears_in_list(logged_in_client):
    logged_in_client.post(
        URL,
        json={"tipo": "proveedor", "nombre": "Insumos SAS"},
        headers=_csrf_headers(logged_in_client),
    )

    response = logged_in_client.get(URL)

    assert response.status_code == 200
    nombres = [tercero["nombre"] for tercero in response.json()]
    assert "Insumos SAS" in nombres


def test_list_third_parties_only_returns_current_company(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    third_parties_service.create_third_party(
        session, empresa_id=otra_empresa.id, tipo="cliente", nombre="Tercero Ajeno"
    )
    logged_in_client.post(
        URL,
        json={"tipo": "cliente", "nombre": "Tercero Propio"},
        headers=_csrf_headers(logged_in_client),
    )

    response = logged_in_client.get(URL)

    nombres = [tercero["nombre"] for tercero in response.json()]
    assert "Tercero Propio" in nombres
    assert "Tercero Ajeno" not in nombres


def test_create_third_party_rejects_invalid_type(logged_in_client):
    response = logged_in_client.post(
        URL,
        json={"tipo": "socio", "nombre": "Carlos"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_third_party_rejects_empty_name(logged_in_client):
    response = logged_in_client.post(
        URL,
        json={"tipo": "cliente", "nombre": "   "},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_create_third_party_requires_authentication(client):
    response = client.post(URL, json={"tipo": "cliente", "nombre": "Carlos"})

    assert response.status_code == 401


def test_update_third_party_returns_200_and_updated_data(logged_in_client):
    created = logged_in_client.post(
        URL,
        json={"tipo": "cliente", "nombre": "Carlos"},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"tipo": "proveedor", "nombre": "Carlos Actualizado"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tipo"] == "proveedor"
    assert body["nombre"] == "Carlos Actualizado"


def test_update_third_party_only_changes_sent_fields(logged_in_client):
    created = logged_in_client.post(
        URL,
        json={"tipo": "cliente", "nombre": "Carlos", "documento": "999"},
        headers=_csrf_headers(logged_in_client),
    ).json()

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
    created = logged_in_client.post(
        URL,
        json={"tipo": "cliente", "nombre": "Carlos"},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"tipo": "socio"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_update_third_party_rejects_empty_name(logged_in_client):
    created = logged_in_client.post(
        URL,
        json={"tipo": "cliente", "nombre": "Carlos"},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"nombre": "   "},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "business_error"


def test_update_third_party_from_other_company_returns_404(logged_in_client, session):
    otra_empresa = Company(nombre="Otra Empresa")
    session.add(otra_empresa)
    session.flush()
    ajeno = third_parties_service.create_third_party(
        session, empresa_id=otra_empresa.id, tipo="cliente", nombre="Tercero Ajeno"
    )

    response = logged_in_client.patch(
        f"{URL}/{ajeno.id}",
        json={"nombre": "Intento de cambio"},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 404


def test_update_third_party_can_deactivate(logged_in_client):
    created = logged_in_client.post(
        URL,
        json={"tipo": "cliente", "nombre": "Carlos"},
        headers=_csrf_headers(logged_in_client),
    ).json()

    response = logged_in_client.patch(
        f"{URL}/{created['id']}",
        json={"activo": False},
        headers=_csrf_headers(logged_in_client),
    )

    assert response.status_code == 200
    assert response.json()["activo"] is False


def test_update_third_party_can_reactivate(logged_in_client):
    created = logged_in_client.post(
        URL,
        json={"tipo": "cliente", "nombre": "Carlos"},
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
