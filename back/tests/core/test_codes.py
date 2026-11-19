from sqlmodel import select

from app.core.codes import next_code
from app.modules.companies.models import Company
from app.modules.services.models import Service
from app.modules.taxes.models import Tax


def _empresa(session, nombre="Panadería Luna") -> Company:
    empresa = Company(nombre=nombre)
    session.add(empresa)
    session.flush()
    return empresa


def _servicio(session, empresa_id, codigo) -> Service:
    servicio = Service(empresa_id=empresa_id, codigo=codigo, nombre=f"Servicio {codigo}")
    session.add(servicio)
    session.flush()
    return servicio


def test_first_code_is_0001(session):
    empresa = _empresa(session)

    assert next_code(session, Service, empresa.id, "S") == "S-0001"


def test_next_code_is_the_highest_plus_one(session):
    empresa = _empresa(session)
    for codigo in ("S-0001", "S-0002", "S-0003"):
        _servicio(session, empresa.id, codigo)

    assert next_code(session, Service, empresa.id, "S") == "S-0004"


def test_deleting_one_from_the_middle_does_not_repeat_a_code(session):
    empresa = _empresa(session)
    primero = _servicio(session, empresa.id, "S-0001")
    _servicio(session, empresa.id, "S-0002")
    _servicio(session, empresa.id, "S-0003")
    session.delete(primero)
    session.flush()

    # Con "cantidad + 1" esto daba S-0003, que ya existe
    assert next_code(session, Service, empresa.id, "S") == "S-0004"


def test_codes_that_do_not_follow_the_form_are_ignored(session):
    empresa = _empresa(session)
    _servicio(session, empresa.id, "S-0002")
    _servicio(session, empresa.id, "S-ABC")
    _servicio(session, empresa.id, "HAR-099")

    assert next_code(session, Service, empresa.id, "S") == "S-0003"


def test_numbering_is_per_company(session):
    una = _empresa(session, "Una")
    otra = _empresa(session, "Otra")
    _servicio(session, una.id, "S-0007")

    assert next_code(session, Service, otra.id, "S") == "S-0001"
