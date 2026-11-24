import pytest
from sqlmodel import select

from app.modules.users import service
from app.modules.users.models import User, UserCompany

URL = "/api/v1/users"

DATOS = {
    "nombre": "María Pérez",
    "email": "maria@example.com",
    "rol": "contador",
    "password": "clave-de-maria",
}


def _csrf_headers(logged_in_client):
    return {"X-CSRF-TOKEN": logged_in_client.cookies.get("csrf_access_token")}


def _create(logged_in_client, **cambios):
    return logged_in_client.post(
        URL, json={**DATOS, **cambios}, headers=_csrf_headers(logged_in_client)
    )


def test_create_user_returns_201_and_saves_it_in_my_company(logged_in_client, session):
    response = _create(logged_in_client)

    assert response.status_code == 201
    user = session.exec(select(User).where(User.email == "maria@example.com")).one()
    link = session.exec(select(UserCompany).where(UserCompany.usuario_id == user.id)).one()
    mi_empresa = session.exec(
        select(UserCompany.empresa_id)
        .join(User, User.id == UserCompany.usuario_id)
        .where(User.email == "johan@example.com")
    ).one()
    assert (user.nombre, user.activo) == ("María Pérez", True)
    assert (link.rol, link.empresa_id) == ("contador", mi_empresa)


def test_create_user_saves_email_lowercase_and_trimmed(logged_in_client, session):
    response = _create(logged_in_client, email="  Maria@Example.COM ")

    assert response.status_code == 201
    assert response.json()["email"] == "maria@example.com"
    assert session.exec(select(User).where(User.email == "maria@example.com")).one()


def test_create_user_with_repeated_email_returns_409_and_creates_nothing(logged_in_client, session):
    usuarios_antes = len(session.exec(select(User)).all())

    # `JOHAN@Example.com` es el mismo correo que el del admin (`johan@example.com`).
    response = _create(logged_in_client, email="JOHAN@Example.com")

    assert response.status_code == 409
    assert len(session.exec(select(User)).all()) == usuarios_antes


def test_create_user_when_two_requests_race_for_the_same_email_returns_409(
    logged_in_client, session, monkeypatch
):
    # Una carrera real: las dos peticiones buscan el correo antes de que cualquiera inserte, y
    # ninguna lo encuentra. Aquí se simula haciendo que la búsqueda no encuentre al admin, así
    # quien frena el duplicado es la restricción `unique` de la base, no la búsqueda.
    monkeypatch.setattr(service, "get_user_by_email", lambda session, email: None)
    usuarios_antes = len(session.exec(select(User)).all())

    response = _create(logged_in_client, email="johan@example.com")

    assert response.status_code == 409
    assert len(session.exec(select(User)).all()) == usuarios_antes
    # La sesión sigue sirviendo después del choque: un segundo intento con un correo nuevo funciona.
    assert _create(logged_in_client).status_code == 201


def test_create_user_with_email_from_another_company_returns_409(logged_in_client, session):
    service.create_company_with_owner(
        session,
        company_name="Café Sol",
        owner_name="Ana",
        email="ana@cafesol.com",
        password="clave-de-ana-123",
    )

    response = _create(logged_in_client, email="ANA@cafesol.com")

    assert response.status_code == 409


@pytest.mark.parametrize("campo", ["nombre", "email", "password"])
def test_create_user_with_empty_field_returns_422_and_creates_nothing(logged_in_client, session, campo):
    usuarios_antes = len(session.exec(select(User)).all())

    # Vacio y solo espacios cuentan como vacio.
    for valor in ["", "   "]:
        response = _create(logged_in_client, **{campo: valor})

        assert response.status_code == 422
    assert len(session.exec(select(User)).all()) == usuarios_antes


@pytest.mark.parametrize("email", ["maria", "maria@", "maria@example", "ma ria@example.com"])
def test_create_user_with_invalid_email_returns_422(logged_in_client, email):
    response = _create(logged_in_client, email=email)

    assert response.status_code == 422


@pytest.mark.parametrize("rol", ["", "propietario", "vendedor", "Admin", "superadmin"])
def test_create_user_with_unknown_role_returns_422_and_creates_nothing(logged_in_client, session, rol):
    usuarios_antes = len(session.exec(select(User)).all())

    response = _create(logged_in_client, rol=rol)

    assert response.status_code == 422
    assert len(session.exec(select(User)).all()) == usuarios_antes


@pytest.mark.parametrize("rol", ["admin", "usuario", "contador"])
def test_create_user_accepts_each_valid_role(logged_in_client, rol):
    response = _create(logged_in_client, rol=rol)

    assert response.status_code == 201
    assert response.json()["rol"] == rol


def test_create_user_with_password_of_7_characters_returns_422_and_8_is_accepted(logged_in_client, session):
    corta = _create(logged_in_client, password="1234567")
    justa = _create(logged_in_client, password="12345678")

    assert corta.status_code == 422
    assert justa.status_code == 201


def test_create_user_with_name_or_email_over_150_characters_returns_422_and_150_is_accepted(
    logged_in_client, session
):
    usuarios_antes = len(session.exec(select(User)).all())
    # Un correo de exactamente 150 caracteres: 138 de la parte local + "@example.com" (12).
    email_150 = "a" * 138 + "@example.com"

    nombre_largo = _create(logged_in_client, nombre="n" * 151)
    email_largo = _create(logged_in_client, email="a" + email_150)

    assert nombre_largo.status_code == 422
    assert email_largo.status_code == 422
    assert len(session.exec(select(User)).all()) == usuarios_antes

    # El límite es inclusivo: 150 sí entra.
    justo = _create(logged_in_client, nombre="n" * 150, email=email_150)
    assert justo.status_code == 201


def test_created_user_can_log_in_and_sees_my_company(logged_in_client):
    _create(logged_in_client)

    # El mismo cliente vuelve a entrar, ahora como la persona nueva: las cookies se reemplazan.
    login = logged_in_client.post(
        "/api/v1/auth/login",
        json={"email": DATOS["email"], "password": DATOS["password"]},
    )
    empresa = logged_in_client.get("/api/v1/company")

    assert login.status_code == 200
    assert empresa.status_code == 200
    assert empresa.json()["nombre"] == "Panadería Luna"
