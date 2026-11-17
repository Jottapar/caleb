import pytest

from app.modules.banks.models import Bank

URL = "/api/v1/banks"


@pytest.fixture
def inactive_bank(session) -> Bank:
    bank = Bank(nombre="Banco Cerrado", activo=False)
    session.add(bank)
    session.flush()
    return bank


def test_list_banks_returns_only_active_banks_in_alphabetical_order(
    logged_in_client, session, inactive_bank
):
    # Los tests crean las tablas con create_all, sin la migracion que carga los bancos.
    session.add(Bank(nombre="Davivienda"))
    session.add(Bank(nombre="Bancolombia"))
    session.flush()

    response = logged_in_client.get(URL)

    assert response.status_code == 200
    nombres = [banco["nombre"] for banco in response.json()]
    assert nombres == ["Bancolombia", "Davivienda"]


def test_list_banks_requires_authentication(client):
    response = client.get(URL)

    assert response.status_code == 401
