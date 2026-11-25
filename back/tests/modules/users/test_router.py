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


def test_list_users_returns_users_of_my_company_with_name_email_role_and_active(logged_in_client):
    _create(logged_in_client)

    response = logged_in_client.get(URL)

    assert response.status_code == 200
    por_correo = {usuario["email"]: usuario for usuario in response.json()}
    assert set(por_correo) == {"johan@example.com", "maria@example.com"}
    assert por_correo["maria@example.com"]["nombre"] == "María Pérez"
    assert por_correo["maria@example.com"]["rol"] == "contador"
    assert por_correo["maria@example.com"]["activo"] is True
    assert por_correo["johan@example.com"]["rol"] == "admin"


def test_list_users_orders_by_name_ascending(logged_in_client):
    # Mayúsculas y tildes mezcladas a propósito: el orden es el de una lista de nombres a ojo.
    for nombre, email in [
        ("Zoe", "zoe@example.com"),
        ("ana", "ana@example.com"),
        ("Beto", "beto@example.com"),
        ("Álvaro", "alvaro@example.com"),
    ]:
        _create(logged_in_client, nombre=nombre, email=email)

    nombres = [usuario["nombre"] for usuario in logged_in_client.get(URL).json()]

    # El admin del fixture se llama «Johan».
    assert nombres == ["Álvaro", "ana", "Beto", "Johan", "Zoe"]


def test_list_users_orders_alphabetically_ignoring_accents_in_the_middle_of_the_name(
    logged_in_client,
):
    # Con la tilde en la primera letra y con ella cambiando el desempate entre «Alberto» y «Álvaro».
    for nombre, email in [
        ("Ana", "ana@example.com"),
        ("Álvaro", "alvaro@example.com"),
        ("Alberto", "alberto@example.com"),
        ("Éric", "eric@example.com"),
        ("Elena", "elena@example.com"),
    ]:
        _create(logged_in_client, nombre=nombre, email=email)

    nombres = [usuario["nombre"] for usuario in logged_in_client.get(URL).json()]

    assert nombres == ["Alberto", "Álvaro", "Ana", "Elena", "Éric", "Johan"]


def test_list_users_orders_n_with_tilde_after_n_and_before_o(logged_in_client):
    # En el abecedario español la Ñ va entre la N y la O.
    for nombre, email in [
        ("Olga", "olga@example.com"),
        ("Ñandú", "nandu@example.com"),
        ("Nora", "nora@example.com"),
    ]:
        _create(logged_in_client, nombre=nombre, email=email)

    nombres = [usuario["nombre"] for usuario in logged_in_client.get(URL).json()]

    assert nombres == ["Johan", "Nora", "Ñandú", "Olga"]


def test_list_users_does_not_include_users_from_other_companies(logged_in_client, session):
    service.create_company_with_owner(
        session,
        company_name="Café Sol",
        owner_name="Ana",
        email="ana@cafesol.com",
        password="clave-de-ana-123",
    )
    _create(logged_in_client)

    correos = {usuario["email"] for usuario in logged_in_client.get(URL).json()}

    assert correos == {"johan@example.com", "maria@example.com"}


def test_list_users_includes_inactive_users(logged_in_client, session):
    _create(logged_in_client)
    maria = session.exec(select(User).where(User.email == "maria@example.com")).one()
    maria.activo = False
    session.add(maria)
    session.commit()

    por_correo = {usuario["email"]: usuario for usuario in logged_in_client.get(URL).json()}

    assert por_correo["maria@example.com"]["activo"] is False
    assert por_correo["johan@example.com"]["activo"] is True


def test_list_users_never_returns_password_hash(logged_in_client):
    _create(logged_in_client)

    usuarios = logged_in_client.get(URL).json()

    assert len(usuarios) == 2
    for usuario in usuarios:
        assert "password_hash" not in usuario
        assert "password" not in usuario


def test_list_users_without_login_returns_401(client):
    assert client.get(URL).status_code == 401


def _patch(logged_in_client, user_id, **cambios):
    return logged_in_client.patch(
        f"{URL}/{user_id}", json=cambios, headers=_csrf_headers(logged_in_client)
    )


def test_update_user_changes_name_email_and_role_and_saves_them(logged_in_client, session):
    maria = _create(logged_in_client).json()

    response = _patch(
        logged_in_client,
        maria["id"],
        nombre="María Gómez",
        email="maria.gomez@example.com",
        rol="admin",
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": maria["id"],
        "nombre": "María Gómez",
        "email": "maria.gomez@example.com",
        "rol": "admin",
        "activo": True,
    }
    user = session.exec(select(User).where(User.id == maria["id"])).one()
    link = session.exec(select(UserCompany).where(UserCompany.usuario_id == maria["id"])).one()
    assert (user.nombre, user.email, link.rol) == ("María Gómez", "maria.gomez@example.com", "admin")


def _login(client, email, password):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_update_user_with_new_email_lets_them_log_in_with_it(logged_in_client):
    maria = _create(logged_in_client).json()

    # El correo llega con mayúsculas y espacios: se guarda limpio, como al crear.
    _patch(
        logged_in_client,
        maria["id"],
        nombre="María Pérez",
        email="  Maria.Nueva@Example.COM ",
        rol="contador",
    )

    assert _login(logged_in_client, "maria@example.com", DATOS["password"]).status_code == 401
    assert _login(logged_in_client, "maria.nueva@example.com", DATOS["password"]).status_code == 200


@pytest.mark.parametrize("de_otra_empresa", [False, True])
def test_update_user_with_email_of_another_user_returns_409_and_changes_nothing(
    logged_in_client, session, de_otra_empresa
):
    maria = _create(logged_in_client).json()
    if de_otra_empresa:
        service.create_company_with_owner(
            session,
            company_name="Café Sol",
            owner_name="Ana",
            email="ana@cafesol.com",
            password="clave-de-ana-123",
        )
    # Distintas mayúsculas a propósito: el correo no distingue entre ellas.
    ocupado = "ANA@cafesol.com" if de_otra_empresa else "JOHAN@Example.com"

    response = _patch(
        logged_in_client, maria["id"], nombre="Otro Nombre", email=ocupado, rol="admin"
    )

    assert response.status_code == 409
    user = session.exec(select(User).where(User.id == maria["id"])).one()
    link = session.exec(select(UserCompany).where(UserCompany.usuario_id == maria["id"])).one()
    assert (user.nombre, user.email, link.rol) == ("María Pérez", "maria@example.com", "contador")


def test_update_user_when_two_requests_race_for_the_same_email_returns_409(
    logged_in_client, session, monkeypatch
):
    maria = _create(logged_in_client).json()
    # Igual que al crear: la búsqueda no encuentra al dueño del correo, así que quien frena el
    # duplicado es la restricción `unique` de la base.
    monkeypatch.setattr(service, "get_user_by_email", lambda session, email: None)

    response = _patch(logged_in_client, maria["id"], nombre="Otro Nombre", email="johan@example.com")

    assert response.status_code == 409
    user = session.exec(select(User).where(User.id == maria["id"])).one()
    assert (user.nombre, user.email) == ("María Pérez", "maria@example.com")
    # La sesión sigue sirviendo después del choque: un cambio válido funciona.
    assert _patch(logged_in_client, maria["id"], nombre="María Gómez").status_code == 200


def test_update_user_keeping_its_own_email_is_not_an_error(logged_in_client):
    maria = _create(logged_in_client).json()

    # Mismo correo, con otras mayúsculas: sigue siendo el suyo, y cambia solo el nombre.
    response = _patch(
        logged_in_client,
        maria["id"],
        nombre="María Gómez",
        email="MARIA@example.com",
        rol="contador",
    )

    assert response.status_code == 200
    assert response.json()["nombre"] == "María Gómez"
    assert response.json()["email"] == "maria@example.com"


@pytest.mark.parametrize(
    "cambios",
    [
        {"nombre": "   "},
        {"email": "   "},
        {"email": "esto-no-es-un-correo"},
        {"rol": "superadmin"},
    ],
)
def test_update_user_with_empty_field_invalid_email_or_unknown_role_returns_422_and_changes_nothing(
    logged_in_client, session, cambios
):
    maria = _create(logged_in_client).json()
    datos = {"nombre": "María Gómez", "email": "maria.gomez@example.com", "rol": "admin"}

    response = _patch(logged_in_client, maria["id"], **{**datos, **cambios})

    assert response.status_code == 422
    user = session.exec(select(User).where(User.id == maria["id"])).one()
    link = session.exec(select(UserCompany).where(UserCompany.usuario_id == maria["id"])).one()
    assert (user.nombre, user.email, link.rol) == ("María Pérez", "maria@example.com", "contador")


def test_update_user_sending_only_the_role_leaves_the_other_fields_untouched(
    logged_in_client, session
):
    maria = _create(logged_in_client).json()

    response = _patch(logged_in_client, maria["id"], rol="admin")

    assert response.status_code == 200
    assert response.json() == {**maria, "rol": "admin"}
    user = session.exec(select(User).where(User.id == maria["id"])).one()
    assert (user.nombre, user.email) == ("María Pérez", "maria@example.com")


ADMIN_EMAIL = "johan@example.com"
ADMIN_PASSWORD = "una-clave-segura"


def test_deactivated_user_cannot_log_in_and_their_open_session_is_cut(logged_in_client):
    maria = _create(logged_in_client).json()
    # María abre sesión y se guardan sus cookies; después el cliente vuelve a ser el Admin.
    _login(logged_in_client, DATOS["email"], DATOS["password"])
    cookies_de_maria = dict(logged_in_client.cookies)
    _login(logged_in_client, ADMIN_EMAIL, ADMIN_PASSWORD)

    response = _patch(logged_in_client, maria["id"], activo=False)

    assert response.status_code == 200
    assert response.json()["activo"] is False
    assert _login(logged_in_client, DATOS["email"], DATOS["password"]).status_code == 401
    # La sesión que María ya tenía abierta tampoco sirve: su siguiente petición da 401.
    logged_in_client.cookies.clear()
    logged_in_client.cookies.update(cookies_de_maria)
    assert logged_in_client.get(URL).status_code == 401


def test_reactivated_user_can_log_in_again_with_the_same_password(logged_in_client):
    maria = _create(logged_in_client).json()
    _patch(logged_in_client, maria["id"], activo=False)
    assert _login(logged_in_client, DATOS["email"], DATOS["password"]).status_code == 401
    _login(logged_in_client, ADMIN_EMAIL, ADMIN_PASSWORD)

    response = _patch(logged_in_client, maria["id"], activo=True)

    assert response.status_code == 200
    assert response.json()["activo"] is True
    assert _login(logged_in_client, DATOS["email"], DATOS["password"]).status_code == 200


def _admin_id(session):
    return session.exec(select(User.id).where(User.email == ADMIN_EMAIL)).one()


def test_update_user_cannot_remove_admin_role_from_the_only_active_admin(
    logged_in_client, session
):
    admin_id = _admin_id(session)

    response = _patch(logged_in_client, admin_id, rol="usuario")

    assert response.status_code == 422
    assert "al menos un Admin activo" in response.json()["message"]
    link = session.exec(select(UserCompany).where(UserCompany.usuario_id == admin_id)).one()
    assert link.rol == "admin"


def test_update_user_can_demote_an_admin_when_another_active_admin_exists(
    logged_in_client, session
):
    _create(logged_in_client, rol="admin")

    response = _patch(logged_in_client, _admin_id(session), rol="usuario")

    assert response.status_code == 200
    assert response.json()["rol"] == "usuario"


def test_an_inactive_admin_does_not_count_as_the_remaining_admin(logged_in_client, session):
    otro = _create(logged_in_client, rol="admin").json()
    # El otro Admin queda inactivo (directo en la base): ya no puede entrar, así que no cuenta.
    otro_user = session.get(User, otro["id"])
    otro_user.activo = False
    session.add(otro_user)
    session.commit()

    response = _patch(logged_in_client, _admin_id(session), rol="usuario")

    assert response.status_code == 422
    assert "al menos un Admin activo" in response.json()["message"]


def test_update_user_cannot_deactivate_the_only_active_admin(logged_in_client, session):
    admin_id = _admin_id(session)

    response = _patch(logged_in_client, admin_id, activo=False)

    assert response.status_code == 422
    assert "al menos un Admin activo" in response.json()["message"]
    assert session.get(User, admin_id).activo is True


def test_update_user_from_another_company_returns_404_and_changes_nothing(
    logged_in_client, session
):
    service.create_company_with_owner(
        session,
        company_name="Café Sol",
        owner_name="Ana",
        email="ana@cafesol.com",
        password="clave-de-ana-123",
    )
    ana = session.exec(select(User).where(User.email == "ana@cafesol.com")).one()

    response = _patch(logged_in_client, ana.id, nombre="Hackeada", rol="usuario", activo=False)

    assert response.status_code == 404
    session.refresh(ana)
    link = session.exec(select(UserCompany).where(UserCompany.usuario_id == ana.id)).one()
    assert (ana.nombre, ana.activo, link.rol) == ("Ana", True, "admin")


def test_admin_can_edit_their_own_data(logged_in_client, session):
    admin_id = _admin_id(session)

    response = _patch(logged_in_client, admin_id, nombre="Johan Pardo", email="johan.pardo@example.com")

    assert response.status_code == 200
    assert response.json()["nombre"] == "Johan Pardo"
    assert response.json()["rol"] == "admin"
    # Su sesión sigue valiendo (va por id, no por correo) y entra con el correo nuevo.
    assert logged_in_client.get(URL).status_code == 200
    assert _login(logged_in_client, "johan.pardo@example.com", ADMIN_PASSWORD).status_code == 200


def test_update_user_without_login_returns_401(client):
    response = client.patch(f"{URL}/1", json={"nombre": "Nadie"})

    assert response.status_code == 401
