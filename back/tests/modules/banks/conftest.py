import pytest

from app.modules.users import service

EMAIL = "johan@example.com"
PASSWORD = "una-clave-segura"


@pytest.fixture
def owner(session):
    """Crea la empresa 'Panadería Luna' y su usuario propietario."""
    service.create_company_with_owner(
        session,
        company_name="Panadería Luna",
        owner_name="Johan",
        email=EMAIL,
        password=PASSWORD,
    )


@pytest.fixture
def logged_in_client(client, owner):
    """El `client` ya logueado como el propietario; las cookies quedan en el cliente."""
    client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})
    return client
