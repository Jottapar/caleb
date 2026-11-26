from sqlmodel import Session, select

from app.core.errors import BusinessError, NotFoundError
from app.core.mixins import utc_now
from app.core.validators import FORMATO_CORREO, SOLO_DIGITOS
from app.modules.banks import service as banks_service
from app.modules.third_parties.models import ThirdParty, ThirdPartyBankAccount
from app.modules.third_parties.schemas import BankAccountData, ThirdPartyCreate, ThirdPartyUpdate

# Sin "ambos": quien es cliente y proveedor se registra dos veces, una con cada tipo.
TIPOS_VALIDOS = {"cliente", "proveedor"}
TIPOS_CUENTA_VALIDOS = {"ahorros", "corriente"}
MAX_DIGITOS_CUENTA = 20

# Columna -> como se le nombra al usuario en el mensaje de error.
# Obligatorios para todo tercero, sea cliente o proveedor.
CAMPOS_OBLIGATORIOS = {
    "nombre": "nombre",
    "documento": "documento",
    "email": "correo",
    "telefono": "teléfono",
    "direccion": "dirección",
}


def _validate_fields(tipo: str, campos: dict[str, str]) -> None:
    """Valida el tipo, que ningun campo obligatorio venga vacio y el formato del correo y el telefono."""
    if tipo not in TIPOS_VALIDOS:
        raise BusinessError(f"Tipo de tercero invalido: {tipo}")
    for columna, etiqueta in CAMPOS_OBLIGATORIOS.items():
        if not campos[columna].strip():
            raise BusinessError(f"El {etiqueta} del tercero es obligatorio")
    # fullmatch: el texto COMPLETO debe cumplir el patron, no solo una parte.
    if not FORMATO_CORREO.fullmatch(campos["email"].strip()):
        raise BusinessError("El correo no tiene un formato válido")
    if not SOLO_DIGITOS.fullmatch(campos["telefono"].strip()):
        raise BusinessError("El teléfono solo puede tener números")


def _build_bank_account(
    session: Session, empresa_id: int, data: BankAccountData
) -> ThirdPartyBankAccount:
    """Valida los datos bancarios y arma la fila, sin guardarla todavia."""
    banks_service.get_active_bank(session, data.banco_id)
    if data.tipo_cuenta not in TIPOS_CUENTA_VALIDOS:
        raise BusinessError(f"Tipo de cuenta invalido: {data.tipo_cuenta}")
    numero_cuenta = data.numero_cuenta.strip()
    if not numero_cuenta:
        raise BusinessError("El número de cuenta es obligatorio")
    if not SOLO_DIGITOS.fullmatch(numero_cuenta):
        raise BusinessError("El número de cuenta solo puede tener números")
    if len(numero_cuenta) > MAX_DIGITOS_CUENTA:
        raise BusinessError(f"El número de cuenta no puede tener más de {MAX_DIGITOS_CUENTA} dígitos")

    return ThirdPartyBankAccount(
        empresa_id=empresa_id,
        banco_id=data.banco_id,
        tipo_cuenta=data.tipo_cuenta,
        numero_cuenta=numero_cuenta,
    )


def create_third_party(session: Session, empresa_id: int, data: ThirdPartyCreate) -> ThirdParty:
    # Todos los campos del tercero son texto: se guardan sin espacios alrededor.
    campos = {
        columna: valor.strip()
        for columna, valor in data.model_dump(exclude={"cuenta_bancaria"}).items()
    }
    _validate_fields(campos["tipo"], campos)
    # Primero se valida todo, cuenta incluida; despues se crea.
    cuenta = (
        _build_bank_account(session, empresa_id, data.cuenta_bancaria)
        if data.cuenta_bancaria
        else None
    )

    third_party = ThirdParty(empresa_id=empresa_id, **campos)
    if cuenta:
        third_party.cuentas_bancarias = [cuenta]
    session.add(third_party)
    session.commit()
    session.refresh(third_party)
    return third_party


def active_third_parties():
    """El `select` de terceros que NO estan eliminados. Es el unico filtro de borrado logico:
    listar, buscar por id y validar un tercero nuevo en un recibo parten de aqui, asi ninguna
    consulta se acuerda del filtro a mano. El historial (recibos) no lo usa: sigue viendo todo."""
    return select(ThirdParty).where(ThirdParty.deleted_at.is_(None))


def list_third_parties(session: Session, empresa_id: int) -> list[ThirdParty]:
    return list(
        session.exec(active_third_parties().where(ThirdParty.empresa_id == empresa_id)).all()
    )


def get_by_id(session: Session, third_party_id: int, empresa_id: int) -> ThirdParty:
    # Filtra por empresa_id en la misma consulta: un tercero de otra empresa
    # da "no encontrado", nunca "prohibido" (no revela que existe).
    third_party = session.exec(
        active_third_parties().where(
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
    # Un tercero no cambia de tipo: cada pantalla (Clientes o Proveedores) maneja solo el suyo.
    # Se acepta que llegue el mismo tipo, porque el formulario de editar lo manda completo.
    if data.tipo is not None and data.tipo.strip() != third_party.tipo:
        raise BusinessError("El tipo de un tercero no se puede cambiar")
    cambios = data.model_dump(exclude_unset=True)
    # `cuenta_bancaria` se maneja aparte: model_dump la convierte en dict, y aqui
    # importa distinguir "no vino" (no esta en cambios) de "vino null" (borrarla).
    cambia_cuenta = "cuenta_bancaria" in cambios
    cambios.pop("cuenta_bancaria", None)
    # `activo` es bool; el resto es texto y se guarda sin espacios alrededor.
    cambios = {
        columna: valor.strip() if isinstance(valor, str) else valor
        for columna, valor in cambios.items()
    }

    # Se valida el estado final (lo que llega mezclado con lo que ya habia):
    # un tercero viejo con campos vacios tiene que completarlos al editarlo.
    estado_final = {
        columna: cambios.get(columna, getattr(third_party, columna))
        for columna in CAMPOS_OBLIGATORIOS
    }
    _validate_fields(cambios.get("tipo", third_party.tipo), estado_final)
    cuenta = (
        _build_bank_account(session, empresa_id, data.cuenta_bancaria)
        if cambia_cuenta and data.cuenta_bancaria
        else None
    )

    third_party.sqlmodel_update(cambios)
    if cambia_cuenta:
        # Reemplazar la lista borra la cuenta anterior (delete-orphan en el modelo).
        third_party.cuentas_bancarias = [cuenta] if cuenta else []
    session.add(third_party)
    session.commit()
    session.refresh(third_party)
    return third_party


def delete_third_party(session: Session, third_party_id: int, empresa_id: int) -> None:
    third_party = get_by_id(session, third_party_id, empresa_id)
    # Borrado logico: la fila se queda (los recibos la siguen apuntando) y solo se marca la fecha.
    third_party.deleted_at = utc_now()
    session.add(third_party)
    session.commit()
