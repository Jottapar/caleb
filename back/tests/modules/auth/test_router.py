from sqlmodel import select

from app.modules.users.models import User
from tests.modules.auth.conftest import EMAIL, PASSWORD


def test_login_with_correct_credentials_sets_cookies_and_returns_200(client, owner):
    response = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})

    assert response.status_code == 200
    assert "access_token_cookie" in response.cookies
    assert "refresh_token_cookie" in response.cookies


def test_login_with_wrong_password_returns_401_generic_message(client, owner):
    response = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "otra-clave"})

    assert response.status_code == 401
    assert response.json()["message"] == "Correo o contraseña incorrectos"


def test_login_with_deactivated_user_returns_401_generic_message(session, client, owner):
    user = session.exec(select(User).where(User.email == EMAIL)).one()
    user.activo = False
    session.add(user)
    session.commit()

    response = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})

    assert response.status_code == 401
    assert response.json()["message"] == "Correo o contraseña incorrectos"


def test_me_with_deactivated_user_returns_401(session, logged_in_client):
    user = session.exec(select(User).where(User.email == EMAIL)).one()
    user.activo = False
    session.add(user)
    session.commit()

    response = logged_in_client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_without_session_returns_401(client):
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_after_login_returns_user_name_and_company_name(logged_in_client):
    response = logged_in_client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json() == {"user_name": "Johan", "company_name": "Panadería Luna"}


def test_logout_then_me_returns_401(logged_in_client):
    logout_response = logged_in_client.post("/api/v1/auth/logout")
    me_response = logged_in_client.get("/api/v1/auth/me")

    assert logout_response.status_code == 200
    assert me_response.status_code == 401


def test_refresh_with_valid_cookie_issues_new_access_that_me_accepts(logged_in_client):
    csrf_token = logged_in_client.cookies.get("csrf_refresh_token")

    refresh_response = logged_in_client.post(
        "/api/v1/auth/refresh", headers={"X-CSRF-TOKEN": csrf_token}
    )
    me_response = logged_in_client.get("/api/v1/auth/me")

    assert refresh_response.status_code == 200
    assert me_response.status_code == 200


def test_refresh_without_cookie_returns_401(client):
    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 401


def test_login_with_nonexistent_email_returns_same_401_generic_message(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "no-existe@example.com", "password": "cualquier-clave"},
    )

    assert response.status_code == 401
    assert response.json()["message"] == "Correo o contraseña incorrectos"
