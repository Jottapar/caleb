import pytest
from sqlalchemy.exc import IntegrityError

from app.modules.companies.models import Company
from app.modules.users.models import User, UserCompany


def test_create_company_and_user_with_role_persists(session):
    company = Company(nombre="Panadería Luna")
    user = User(nombre="Johan", email="johan@example.com", password_hash="hash-no-es-el-password")
    session.add(company)
    session.add(user)
    session.commit()

    link = UserCompany(usuario_id=user.id, empresa_id=company.id, rol="propietario")
    session.add(link)
    session.commit()

    session.refresh(company)
    session.refresh(user)
    session.refresh(link)

    assert company.nombre == "Panadería Luna"
    assert user.email == "johan@example.com"
    assert link.usuario_id == user.id
    assert link.empresa_id == company.id
    assert link.rol == "propietario"


def test_user_email_unique_duplicate_raises_integrity_error(session):
    session.add(User(nombre="Johan", email="duplicado@example.com", password_hash="hash-1"))
    session.commit()

    session.add(User(nombre="Otro", email="duplicado@example.com", password_hash="hash-2"))
    with pytest.raises(IntegrityError):
        session.commit()
