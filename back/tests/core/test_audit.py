from sqlalchemy import event
from sqlmodel import select

from app.modules.banks.models import Bank
from app.modules.companies.models import Company
from app.modules.taxes.models import Tax
from app.modules.users.models import User, UserCompany


def _caleb_id(session) -> int:
    return session.exec(select(User.id).where(User.email == "caleb@caleb.com")).one()


def _company_with_bank_and_tax(session):
    company = Company(nombre="Panadería Luna")
    session.add(company)
    session.flush()
    bank = Bank(nombre="Bancolombia")
    tax = Tax(empresa_id=company.id, nombre="IVA 19%", porcentaje=19)
    session.add_all([bank, tax])
    session.flush()
    return bank, tax


def test_bank_and_tax_save_created_at_and_updated_at_equal_on_creation(session):
    bank, tax = _company_with_bank_and_tax(session)

    for row in (bank, tax):
        assert row.created_at == row.updated_at
        # Con zona horaria: una hora «naive» dependería del servidor donde corra la app.
        assert row.created_at.tzinfo is not None


def test_editing_a_bank_or_tax_changes_updated_at_but_not_created_at(session):
    bank, tax = _company_with_bank_and_tax(session)
    creado = {"bank": bank.created_at, "tax": tax.created_at}
    session.commit()

    bank.nombre = "Davivienda"
    tax.nombre = "IVA 5%"
    session.commit()

    assert bank.created_at == creado["bank"]
    assert tax.created_at == creado["tax"]
    assert bank.updated_at > bank.created_at
    assert tax.updated_at > tax.created_at


def test_saving_a_row_without_changes_keeps_its_updated_at(session):
    bank, tax = _company_with_bank_and_tax(session)
    session.commit()
    antes = {"bank": bank.updated_at, "tax": tax.updated_at}

    # Mismo valor: SQLAlchemy la marca como modificada, pero el dato no cambió.
    bank.nombre = bank.nombre
    tax.nombre = tax.nombre
    session.commit()

    assert bank.updated_at == antes["bank"]
    assert tax.updated_at == antes["tax"]


def test_company_created_without_a_request_has_caleb_as_author(session):
    company = Company(nombre="Panadería Luna")
    session.add(company)
    session.flush()

    caleb = _caleb_id(session)
    assert company.created_by_id == caleb
    assert company.updated_by_id == caleb
    assert company.created_at == company.updated_at


def test_user_and_company_link_created_without_a_request_have_caleb_as_author(session):
    company = Company(nombre="Panadería Luna")
    user = User(nombre="Johan", email="johan@example.com", password_hash="hash-de-prueba")
    session.add_all([company, user])
    session.flush()
    link = UserCompany(usuario_id=user.id, empresa_id=company.id, rol="admin")
    session.add(link)
    session.flush()

    caleb = _caleb_id(session)
    for row in (user, link):
        assert row.created_by_id == caleb
        assert row.updated_by_id == caleb
        assert row.created_at == row.updated_at


def test_rows_created_without_a_request_look_up_caleb_only_once_per_session(session):
    consultas = []

    def contar(conn, cursor, statement, parameters, context, executemany):
        if "FROM usuarios" in statement and "usuarios.email" in statement:
            consultas.append(statement)

    conexion = session.get_bind()
    event.listen(conexion, "before_cursor_execute", contar)
    try:
        # Tres empresas en un guardado y otra en un segundo guardado, todas sin petición.
        session.add_all([Company(nombre=f"Empresa {numero}") for numero in range(3)])
        session.flush()
        session.add(Company(nombre="Empresa 4"))
        session.flush()
    finally:
        event.remove(conexion, "before_cursor_execute", contar)

    assert len(consultas) == 1


def test_changing_a_row_in_the_same_transaction_that_created_it_is_still_the_creation(session):
    bank, tax = _company_with_bank_and_tax(session)

    # Se crea y se modifica antes del commit (como un servicio que guarda y luego calcula totales).
    bank.nombre = "Davivienda"
    tax.nombre = "IVA 5%"
    session.flush()

    for fila in (bank, tax):
        assert fila.updated_at == fila.created_at
    session.commit()

    # Ya con el commit hecho, la creación terminó: ahora sí es una edición.
    bank.nombre = "Bogotá"
    tax.nombre = "IVA 0%"
    session.commit()

    for fila in (bank, tax):
        assert fila.updated_at > fila.created_at
