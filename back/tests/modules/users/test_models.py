import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.modules.companies.models import Company
from app.modules.users.models import User, UserCompany


def test_create_company_and_user_with_role_persists(session):
    company = Company(nombre="Panadería Luna")
    user = User(nombre="Johan", email="johan@example.com", password_hash="hash-no-es-el-password")
    session.add(company)
    session.add(user)
    session.commit()

    link = UserCompany(usuario_id=user.id, empresa_id=company.id, rol="admin")
    session.add(link)
    session.commit()

    session.refresh(company)
    session.refresh(user)
    session.refresh(link)

    assert company.nombre == "Panadería Luna"
    assert user.email == "johan@example.com"
    assert link.usuario_id == user.id
    assert link.empresa_id == company.id
    assert link.rol == "admin"


def test_user_email_unique_duplicate_raises_integrity_error(session):
    session.add(User(nombre="Johan", email="duplicado@example.com", password_hash="hash-1"))
    session.commit()

    session.add(User(nombre="Otro", email="duplicado@example.com", password_hash="hash-2"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_user_company_role_defaults_to_usuario():
    # El rol por defecto es el de menos responsabilidad: quien no lo pide, no queda de admin.
    assert UserCompany(usuario_id=1, empresa_id=1).rol == "usuario"


def test_caleb_exists_inactive_and_without_a_company(session):
    # Caleb es el sistema: el correo sale del criterio de la historia 16h, no del código.
    caleb = session.exec(select(User).where(User.email == "caleb@caleb.com")).one()

    assert caleb.nombre == "Caleb"
    assert caleb.activo is False
    # No pertenece a ninguna empresa: por eso no sale en ninguna lista.
    links = session.exec(select(UserCompany).where(UserCompany.usuario_id == caleb.id)).all()
    assert links == []


def test_caleb_is_his_own_author(session):
    caleb = session.exec(select(User).where(User.email == "caleb@caleb.com")).one()

    assert caleb.created_by_id == caleb.id
    assert caleb.updated_by_id == caleb.id
