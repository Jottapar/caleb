URL = "/api/v1/taxes"


def test_list_taxes_returns_the_seeded_defaults(logged_in_client):
    response = logged_in_client.get(URL)

    assert response.status_code == 200
    nombres = {tax["nombre"] for tax in response.json()}
    assert nombres == {"Sin impuesto", "IVA 19%"}


def test_list_taxes_requires_authentication(client):
    response = client.get(URL)

    assert response.status_code == 401
