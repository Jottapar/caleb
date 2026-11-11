from sqlmodel import Session, select

from app.core.errors import BusinessError, NotFoundError
from app.modules.third_parties.models import ThirdParty
from app.modules.third_parties.schemas import ThirdPartyUpdate

TIPOS_VALIDOS = {"cliente", "proveedor", "ambos"}


def _validate_type_and_name(tipo: str, nombre: str) -> None:
    if tipo not in TIPOS_VALIDOS:
        raise BusinessError(f"Tipo de tercero invalido: {tipo}")
    if not nombre.strip():
        raise BusinessError("El nombre del tercero es obligatorio")


def create_third_party(
    session: Session,
    empresa_id: int,
    tipo: str,
    nombre: str,
    documento: str = "",
    email: str = "",
    telefono: str = "",
) -> ThirdParty:
    _validate_type_and_name(tipo, nombre)

    third_party = ThirdParty(
        empresa_id=empresa_id,
        tipo=tipo,
        nombre=nombre,
        documento=documento,
        email=email,
        telefono=telefono,
    )
    session.add(third_party)
    session.commit()
    session.refresh(third_party)
    return third_party


def list_third_parties(session: Session, empresa_id: int) -> list[ThirdParty]:
    return list(session.exec(select(ThirdParty).where(ThirdParty.empresa_id == empresa_id)).all())


def get_by_id(session: Session, third_party_id: int, empresa_id: int) -> ThirdParty:
    # Filtra por empresa_id en la misma consulta: un tercero de otra empresa
    # da "no encontrado", nunca "prohibido" (no revela que existe).
    third_party = session.exec(
        select(ThirdParty).where(
            ThirdParty.id == third_party_id, ThirdParty.empresa_id == empresa_id
        )
    ).first()
    if not third_party:
        raise NotFoundError("Tercero", third_party_id)
    return third_party


def update_third_party(
    session: Session, third_party_id: int, data: ThirdPartyUpdate, empresa_id: int
) -> ThirdParty:
    third_party = get_by_id(session, third_party_id, empresa_id)
    cambios = data.model_dump(exclude_unset=True)
    _validate_type_and_name(
        cambios.get("tipo", third_party.tipo), cambios.get("nombre", third_party.nombre)
    )

    third_party.sqlmodel_update(cambios)
    session.add(third_party)
    session.commit()
    session.refresh(third_party)
    return third_party


def delete_third_party(session: Session, third_party_id: int, empresa_id: int) -> None:
    third_party = get_by_id(session, third_party_id, empresa_id)
    session.delete(third_party)
    session.commit()
