import re
import unicodedata
from io import BytesIO
from uuid import uuid4

from botocore.exceptions import BotoCoreError, ClientError
from loguru import logger
from PIL import Image, ImageOps
from sqlmodel import Session

from app.core.errors import BusinessError, NotFoundError
from app.core.storage import Storage
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


# Formato real de la imagen (como lo llama Pillow al leer el contenido) -> (extension con la que se
# guarda en el bucket, tipo de contenido con el que se entrega). Es la unica tabla: el formato
# real manda, no el nombre del archivo ni el tipo que declara el navegador.
FORMATOS_LOGO = {
    "PNG": ("png", "image/png"),
    "JPEG": ("jpg", "image/jpeg"),
    "WEBP": ("webp", "image/webp"),
}
TIPOS_LOGO = {tipo for _, tipo in FORMATOS_LOGO.values()}  # lo que el navegador puede declarar
TIPO_POR_EXTENSION = {extension: tipo for extension, tipo in FORMATOS_LOGO.values()}

MENSAJE_TIPO_LOGO = "El logo debe ser una imagen PNG, JPG o WebP"
LADO_MAXIMO_LOGO = 512  # pixeles del lado mas largo
PIXELES_MAXIMOS_LOGO = 25_000_000  # ancho x alto: frena las "imagenes bomba"
MENSAJE_PIXELES_LOGO = (
    "La imagen es demasiado grande en píxeles (máximo 25 megapíxeles, por ejemplo 5000 × 5000)"
)
PESO_MAXIMO_LOGO = 5 * 1024 * 1024  # bytes que puede pesar el archivo que sube el usuario


def _resize_logo(contenido: bytes) -> tuple[bytes, str]:
    """Achica la imagen para que su lado mas largo mida a lo sumo 512 px, en su mismo formato.

    Devuelve los bytes nuevos y el formato real (`"PNG"`, `"JPEG"` o `"WEBP"`).

    `thumbnail` conserva la proporcion y nunca agranda: una imagen mas chica queda igual.
    """
    try:
        imagen = Image.open(BytesIO(contenido))
        formato = imagen.format  # se lee antes: despues de transformar, Pillow lo pierde
        # El tipo que declara el navegador se puede mentir (un GIF renombrado a .png): manda el real.
        if formato not in FORMATOS_LOGO:
            raise BusinessError(MENSAJE_TIPO_LOGO)
        # `open` solo lee el encabezado: aqui todavia no se gasto memoria en decodificar. Una imagen
        # pequena en bytes puede declarar dimensiones enormes; se frena antes de abrirla de verdad.
        if imagen.width * imagen.height > PIXELES_MAXIMOS_LOGO:
            raise BusinessError(MENSAJE_PIXELES_LOGO)
        imagen.thumbnail((LADO_MAXIMO_LOGO, LADO_MAXIMO_LOGO))
        # Las fotos de celular guardan los pixeles acostados y una etiqueta EXIF que dice como
        # girarlos. Pillow no la aplica solo: sin esto el logo saldria rotado. Al guardar sin EXIF,
        # tambien se pierden los metadatos (ubicacion GPS, modelo de camara).
        imagen = ImageOps.exif_transpose(imagen)
        salida = BytesIO()
        imagen.save(salida, formato)
    except Image.DecompressionBombError:
        # Pillow se niega a abrir imagenes de mas de ~179 megapixeles y lanza este error al abrir,
        # antes de que llegue nuestra revision. Es el mismo motivo: demasiados pixeles.
        raise BusinessError(MENSAJE_PIXELES_LOGO) from None
    except OSError:
        # Pillow lanza una subclase de OSError cuando los bytes no son una imagen o estan truncados.
        raise BusinessError("La imagen está dañada y no se puede abrir") from None
    return salida.getvalue(), formato


def _slug(nombre: str) -> str:
    """Convierte un nombre en algo seguro para una carpeta: 'Panadería La Esquina' -> 'panaderia-la-esquina'.

    Recibe el nombre de la empresa (str) y devuelve un str en minusculas, sin tildes, con guiones en
    vez de espacios y sin simbolos. Se corta a 60 caracteres para que la ruta quepa en `logo_ruta`.
    Si el nombre no deja nada (solo simbolos), devuelve 'empresa'.
    """
    # NFKD separa la letra de su tilde ('á' -> 'a' + tilde); ascii/ignore descarta las tildes sueltas
    sin_tildes = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode()
    # Todo lo que no sea letra o numero (espacios, '/', '&'...) se vuelve un solo guion
    slug = re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")
    return slug[:60].strip("-") or "empresa"


def _delete_unused_file(storage: Storage, ruta: str) -> None:
    """Borra un archivo que ya no usa ninguna empresa, sin hacer fallar la peticion si R2 no responde.

    Se llama despues de guardar el cambio en la base: para el usuario la operacion ya salio bien. Si
    el borrado falla, el archivo queda huerfano en el bucket (no estorba a nadie) y se anota en el
    log para poder limpiarlo a mano.
    """
    try:
        storage.delete(ruta)
    except (BotoCoreError, ClientError):
        logger.exception(f"No se pudo borrar '{ruta}' del almacén; queda huérfano")


def save_logo(
    session: Session, storage: Storage, empresa_id: int, contenido: bytes, content_type: str
) -> None:
    """Guarda `contenido` (achicado) como el logo de la empresa y anota su ruta en `logo_ruta`.

    El nombre lleva un uuid, asi cada subida tiene una ruta nueva. El archivo se sube antes de
    guardar en la base: si el `commit` fallara, el archivo nuevo queda huerfano en el bucket (la
    empresa conserva su logo anterior). Es raro y no daña nada, por eso no se complica el codigo.
    """
    if content_type not in TIPOS_LOGO:
        raise BusinessError(MENSAJE_TIPO_LOGO)
    if len(contenido) > PESO_MAXIMO_LOGO:
        raise BusinessError("El logo no puede pesar más de 5 MB")
    company = get_company(session, empresa_id)
    imagen, formato = _resize_logo(contenido)
    extension, tipo = FORMATOS_LOGO[formato]
    carpeta = f"{_slug(company.nombre)}-{empresa_id}"  # el id evita choques entre empresas de igual nombre
    ruta = f"empresas/{carpeta}/logo/{uuid4().hex}.{extension}"
    storage.save(ruta, imagen, tipo)
    ruta_anterior = company.logo_ruta
    company.logo_ruta = ruta
    session.add(company)
    session.commit()
    # El anterior se borra al final: si algo fallara antes, la empresa no se queda sin logo.
    if ruta_anterior:
        _delete_unused_file(storage, ruta_anterior)


def read_logo(session: Session, storage: Storage, empresa_id: int) -> tuple[bytes, str]:
    """El logo de la empresa: sus bytes y su tipo (`image/png`...). 404 si no tiene."""
    company = get_company(session, empresa_id)
    contenido = storage.read(company.logo_ruta) if company.logo_ruta else None
    if contenido is None:
        raise NotFoundError("Logo")
    return contenido, TIPO_POR_EXTENSION[company.logo_ruta.rsplit(".", 1)[1]]


def remove_logo(session: Session, storage: Storage, empresa_id: int) -> None:
    """Quita el logo: borra el archivo y deja la empresa sin logo (`logo_ruta` = ''). Sin logo, no hace nada."""
    company = get_company(session, empresa_id)
    ruta = company.logo_ruta
    if not ruta:
        return
    company.logo_ruta = ""
    session.add(company)
    session.commit()
    _delete_unused_file(storage, ruta)
