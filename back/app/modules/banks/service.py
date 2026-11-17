from sqlmodel import Session, select

from app.core.errors import NotFoundError
from app.modules.banks.models import Bank


def list_active_banks(session: Session) -> list[Bank]:
    """Los bancos que se ofrecen en el desplegable, en orden alfabetico."""
    return list(session.exec(select(Bank).where(Bank.activo).order_by(Bank.nombre)).all())


def get_active_bank(session: Session, bank_id: int) -> Bank:
    """Un banco que se puede elegir. Uno inactivo da "no encontrado", igual que uno que no existe."""
    bank = session.exec(select(Bank).where(Bank.id == bank_id, Bank.activo)).first()
    if not bank:
        raise NotFoundError("Banco", bank_id)
    return bank
