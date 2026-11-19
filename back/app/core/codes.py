import re

from sqlmodel import Session, SQLModel, select


def next_code(session: Session, model: type[SQLModel], empresa_id: int, prefix: str) -> str:
    """Siguiente código con forma `P-0001`: el número más alto que ya existe, más uno.

    Recibe la sesión, la tabla (`Item`, `Service`, `TechnicalSheet`: cualquier modelo con
    `empresa_id` y `codigo`), la empresa y el prefijo (`"P"`, `"S"`, `"F"`). Devuelve el texto.

    No cuenta cuántos registros hay: si se eliminó uno del medio, contar daría un código que
    ya existe. Los códigos que no tienen la forma `<prefijo>-<dígitos>` (uno escrito a mano,
    como `HAR-001`) se ignoran.
    """
    codigos = session.exec(
        select(model.codigo).where(
            model.empresa_id == empresa_id, model.codigo.like(f"{prefix}-%")
        )
    ).all()
    patron = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    numeros = [int(m.group(1)) for codigo in codigos if (m := patron.match(codigo))]
    return f"{prefix}-{max(numeros, default=0) + 1:04d}"
