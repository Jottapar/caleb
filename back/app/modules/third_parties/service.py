from sqlmodel import Session, select

from app.core.errors import BusinessError
from app.modules.third_parties.models import ThirdParty

TIPOS_VALIDOS = {"cliente", "proveedor", "ambos"}


def create_third_party(
    session: Session,
    empresa_id: int,
    tipo: str,
    nombre: str,
    documento: str = "",
    email: str = "",
    telefono: str = "",
) -> ThirdParty:
    if tipo not in TIPOS_VALIDOS:
        raise BusinessError(f"Tipo de tercero invalido: {tipo}")
    if not nombre.strip():
        raise BusinessError("El nombre del tercero es obligatorio")

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
