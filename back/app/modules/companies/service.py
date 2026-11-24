from sqlmodel import Session

from app.core.errors import BusinessError, NotFoundError
from app.core.validators import FORMATO_CORREO, SOLO_DIGITOS
from app.modules.companies.models import Company
from app.modules.companies.schemas import CompanyUpdate


def get_company(session: Session, empresa_id: int) -> Company:
    """La empresa del usuario. Siempre se busca por el `empresa_id` de su sesion, nunca por uno que llegue en la URL."""
    company = session.get(Company, empresa_id)
    if company is None:
        raise NotFoundError("Empresa", empresa_id)
    return company


# Columna -> (como se nombra al usuario, largo maximo). El largo es el de la columna en
# `Company`: si uno cambia, el otro tambien.
LARGOS_MAXIMOS = {
    "nombre": ("El nombre", 150),
    "documento_fiscal": ("El NIT", 30),
    "direccion": ("La dirección", 200),
    "telefono": ("El teléfono", 30),
    "email": ("El correo", 150),
}


def _validate_changes(cambios: dict[str, str | None]) -> None:
    """Valida solo los campos que llegaron. Un `nombre` que llega vacio (o null) se rechaza."""
    if "nombre" in cambios and not cambios["nombre"]:
        raise BusinessError("El nombre de la empresa es obligatorio")
    for columna, (etiqueta, maximo) in LARGOS_MAXIMOS.items():
        valor = cambios.get(columna)
        if valor and len(valor) > maximo:
            raise BusinessError(f"{etiqueta} no puede tener más de {maximo} caracteres")
    # El NIT es opcional: vacio se acepta; si trae algo, solo digitos (el ultimo es el de verificacion).
    nit = cambios.get("documento_fiscal")
    if nit and not SOLO_DIGITOS.fullmatch(nit):
        raise BusinessError("El NIT solo puede tener números")
    telefono = cambios.get("telefono")
    if telefono and not SOLO_DIGITOS.fullmatch(telefono):
        raise BusinessError("El teléfono solo puede tener números")
    email = cambios.get("email")
    if email and not FORMATO_CORREO.fullmatch(email):
        raise BusinessError("El correo no tiene un formato válido")


def _clean_value(columna: str, valor: str | None) -> str | None:
    """Deja un valor listo para guardar: texto sin espacios alrededor.

    Un `null` en un dato opcional se guarda como '' (ninguna columna queda en NULL).
    En `nombre` se deja pasar como None para que la validacion lo rechace.
    """
    if valor is None:
        return None if columna == "nombre" else ""
    return valor.strip()


def update_company(session: Session, empresa_id: int, data: CompanyUpdate) -> Company:
    """Aplica solo los campos que llegaron (exclude_unset) y devuelve la empresa guardada."""
    company = get_company(session, empresa_id)
    cambios = {
        columna: _clean_value(columna, valor)
        for columna, valor in data.model_dump(exclude_unset=True).items()
    }
    # Se valida todo antes de tocar la empresa: si algo falla, no se guarda nada.
    _validate_changes(cambios)
    for columna, valor in cambios.items():
        setattr(company, columna, valor)
    session.add(company)
    session.commit()
    session.refresh(company)
    return company
