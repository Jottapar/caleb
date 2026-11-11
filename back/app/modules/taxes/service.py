from sqlmodel import Session, select

from app.modules.taxes.models import Tax

DEFAULTS = [("Sin impuesto", 0), ("IVA 19%", 19)]


def seed_default_taxes(session: Session, empresa_id: int) -> None:
    """Crea los impuestos por defecto de una empresa nueva. Lo usa create_company_with_owner."""
    for nombre, porcentaje in DEFAULTS:
        session.add(Tax(empresa_id=empresa_id, nombre=nombre, porcentaje=porcentaje))


def list_taxes(session: Session, empresa_id: int) -> list[Tax]:
    return list(session.exec(select(Tax).where(Tax.empresa_id == empresa_id)).all())
