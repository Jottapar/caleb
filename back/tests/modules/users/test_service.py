import pytest
from sqlmodel import select

from app.core.errors import AlreadyExistsError, NotFoundError
from app.core.security import password_hash
from app.modules.companies.models import Company
from app.modules.taxes.models import Tax
from app.modules.users import service
from app.modules.users.models import User, UserCompany


def test_create_company_creates_company_and_owner_user(session):
    service.create_company_with_owner(
        session,
        company_name="Panadería Luna",
        owner_name="Johan",
        email="johan@example.com",
        password="una-clave-segura",
    )

    company = session.exec(select(Company).where(Company.nombre == "Panadería Luna")).one()
    user = session.exec(select(User).where(User.email == "johan@example.com")).one()
    link = session.exec(
        select(UserCompany).where(
            UserCompany.usuario_id == user.id, UserCompany.empresa_id == company.id
        )
    ).one()

    assert link.rol == "admin"


def test_create_company_hashes_password(session):
    service.create_company_with_owner(
        session,
        company_name="Panadería Luna",
        owner_name="Johan",
        email="johan@example.com",
        password="una-clave-segura",
    )

    user = session.exec(select(User).where(User.email == "johan@example.com")).one()

    assert user.password_hash != "una-clave-segura"
    assert password_hash.verify("una-clave-segura", user.password_hash)


def test_create_company_rejects_duplicate_email(session):
    service.create_company_with_owner(
        session,
        company_name="Empresa 1",
        owner_name="Johan",
        email="duplicado@example.com",
        password="clave-1",
    )

    with pytest.raises(AlreadyExistsError):
        service.create_company_with_owner(
            session,
            company_name="Empresa 2",
            owner_name="Otro",
            email="duplicado@example.com",
            password="clave-2",
        )

    empresa_2 = session.exec(select(Company).where(Company.nombre == "Empresa 2")).all()
    assert empresa_2 == []


def test_create_company_with_owner_seeds_default_taxes(session):
    service.create_company_with_owner(
        session,
        company_name="Panadería Luna",
        owner_name="Johan",
        email="johan@example.com",
        password="una-clave-segura",
    )

    company = session.exec(select(Company).where(Company.nombre == "Panadería Luna")).one()
    taxes = session.exec(select(Tax).where(Tax.empresa_id == company.id)).all()
    nombres_y_porcentajes = {(tax.nombre, tax.porcentaje) for tax in taxes}

    assert nombres_y_porcentajes == {("Sin impuesto", 0), ("IVA 19%", 19)}


def test_create_company_saves_email_in_lowercase_without_spaces(session):
    service.create_company_with_owner(
        session,
        company_name="Panadería Luna",
        owner_name="Johan",
        email="  Johan@Example.COM ",
        password="una-clave-segura",
    )

    user = session.exec(select(User).where(User.nombre == "Johan")).one()

    assert user.email == "johan@example.com"


def test_create_company_rejects_same_email_with_different_case(session):
    service.create_company_with_owner(
        session,
        company_name="Empresa 1",
        owner_name="Johan",
        email="duplicado@example.com",
        password="clave-1",
    )

    with pytest.raises(AlreadyExistsError):
        service.create_company_with_owner(
            session,
            company_name="Empresa 2",
            owner_name="Otro",
            email="Duplicado@Example.com",
            password="clave-2",
        )


def test_get_user_by_email_finds_user_saved_with_uppercase(session):
    # Simula un usuario creado antes de la regla, con mayusculas en la base.
    session.add(User(nombre="Viejo", email="Viejo@Example.com", password_hash="x"))
    session.commit()

    user = service.get_user_by_email(session, "viejo@example.com")

    assert user is not None
    assert user.nombre == "Viejo"


def test_reset_password_changes_password_ignoring_email_case(session):
    service.create_company_with_owner(
        session,
        company_name="Panadería Luna",
        owner_name="Johan",
        email="johan@example.com",
        password="clave-vieja",
    )

    service.reset_password(session, email="JOHAN@example.com", new_password="clave-nueva")

    user = session.exec(select(User).where(User.email == "johan@example.com")).one()
    assert password_hash.verify("clave-nueva", user.password_hash)
    assert not password_hash.verify("clave-vieja", user.password_hash)


def test_reset_password_with_unknown_email_raises_not_found(session):
    with pytest.raises(NotFoundError):
        service.reset_password(session, email="nadie@example.com", new_password="clave")
