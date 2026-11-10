import pytest
from sqlmodel import select

from app.core.errors import AlreadyExistsError
from app.core.security import password_hash
from app.modules.companies.models import Company
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

    assert link.rol == "propietario"


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
