import os
from io import BytesIO
from uuid import uuid4

import pytest
from botocore.exceptions import ClientError
from PIL import Image

from app.core.storage import Storage, get_storage
from app.main import app
from app.modules.users import service as users_service

URL = "/api/v1/company/logo"


@pytest.fixture
def storage(client):
    """El almacen real (caleb-dev), con una carpeta propia para este test.

    Sustituye al almacen de la app por uno con prefijo `tests/<id-aleatorio>/`, y al terminar
    borra todo lo que haya quedado ahi. Depende de `client` para que su limpieza de
    `dependency_overrides` ocurra despues de la nuestra.
    """
    almacen = Storage(prefix=f"tests/{uuid4().hex}/")
    app.dependency_overrides[get_storage] = lambda: almacen
    yield almacen
    almacen.delete_all()


def _csrf_headers(logged_in_client):
    return {"X-CSRF-TOKEN": logged_in_client.cookies.get("csrf_access_token")}


def _image(width: int, height: int, formato: str = "PNG", modo: str = "RGB") -> bytes:
    """Los bytes de una imagen de color liso, del tamano y formato pedidos."""
    buffer = BytesIO()
    Image.new(modo, (width, height), "red").save(buffer, formato)
    return buffer.getvalue()


def _upload(logged_in_client, contenido: bytes, nombre="logo.png", tipo="image/png"):
    return logged_in_client.put(
        URL,
        files={"file": (nombre, contenido, tipo)},
        headers=_csrf_headers(logged_in_client),
    )


def test_uploaded_logo_can_be_downloaded(logged_in_client, storage):
    response = _upload(logged_in_client, _image(60, 40))
    assert response.status_code == 204

    response = logged_in_client.get(URL)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert Image.open(BytesIO(response.content)).size == (60, 40)


def test_me_includes_the_logo_version_for_the_header(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    assert logged_in_client.get(url_me).json()["logo_version"] == ""

    _upload(logged_in_client, _image(60, 40))

    assert logged_in_client.get(url_me).json()["logo_version"].endswith(".png")


def test_big_logo_is_shrunk_to_512_on_its_longest_side_keeping_proportion(logged_in_client, storage):
    _upload(logged_in_client, _image(2000, 1000))

    response = logged_in_client.get(URL)

    assert Image.open(BytesIO(response.content)).size == (512, 256)


def test_png_logo_keeps_its_transparency(logged_in_client, storage):
    # Una imagen de 1000x1000 totalmente transparente (alfa 0): tambien se achica, por eso se
    # prueba aqui que el achicado no la vuelva opaca.
    buffer = BytesIO()
    Image.new("RGBA", (1000, 1000), (255, 0, 0, 0)).save(buffer, "PNG")
    _upload(logged_in_client, buffer.getvalue())

    response = logged_in_client.get(URL)

    imagen = Image.open(BytesIO(response.content))
    assert imagen.mode == "RGBA"
    assert imagen.getpixel((0, 0))[3] == 0


def test_replacing_the_logo_deletes_the_previous_file_and_changes_the_version(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    primera = logged_in_client.get(url_me).json()["logo_version"]

    _upload(logged_in_client, _image(80, 50))
    segunda = logged_in_client.get(url_me).json()["logo_version"]

    assert segunda != primera
    assert storage.read(primera) is None
    assert storage.read(segunda) is not None


def test_a_file_that_is_not_png_jpg_or_webp_is_rejected_and_the_logo_stays(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    version = logged_in_client.get(url_me).json()["logo_version"]

    response = _upload(logged_in_client, _image(60, 40, formato="GIF"), "logo.gif", "image/gif")

    assert response.status_code == 422
    assert response.json()["message"] == "El logo debe ser una imagen PNG, JPG o WebP"
    assert logged_in_client.get(url_me).json()["logo_version"] == version


def test_a_logo_over_5_mb_is_rejected_and_the_logo_stays(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    version = logged_in_client.get(url_me).json()["logo_version"]
    # Una imagen real de ruido: el ruido no se comprime, asi el PNG pesa mas de 5 MB.
    ruido = Image.frombytes("RGB", (1500, 1500), os.urandom(1500 * 1500 * 3))
    buffer = BytesIO()
    ruido.save(buffer, "PNG")
    assert len(buffer.getvalue()) > 5 * 1024 * 1024

    response = _upload(logged_in_client, buffer.getvalue())

    assert response.status_code == 422
    assert response.json()["message"] == "El logo no puede pesar más de 5 MB"
    assert logged_in_client.get(url_me).json()["logo_version"] == version


def test_a_corrupt_image_is_rejected_and_the_logo_stays(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    version = logged_in_client.get(url_me).json()["logo_version"]

    # Dice ser un PNG, pero sus bytes no son una imagen.
    response = _upload(logged_in_client, b"esto no es una imagen")

    assert response.status_code == 422
    assert response.json()["message"] == "La imagen está dañada y no se puede abrir"
    assert logged_in_client.get(url_me).json()["logo_version"] == version


def test_removing_the_logo_deletes_the_file_and_leaves_the_company_without_logo(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    version = logged_in_client.get(url_me).json()["logo_version"]

    response = logged_in_client.delete(URL, headers=_csrf_headers(logged_in_client))

    assert response.status_code == 204
    assert logged_in_client.get(url_me).json()["logo_version"] == ""
    assert storage.read(version) is None
    assert logged_in_client.get(URL).status_code == 404


def test_another_company_does_not_see_my_logo(logged_in_client, storage, session):
    _upload(logged_in_client, _image(60, 40))
    users_service.create_company_with_owner(
        session,
        company_name="Otra Empresa",
        owner_name="Ana",
        email="ana@example.com",
        password="otra-clave-segura",
    )
    # El login de Ana reemplaza las cookies del cliente: desde aqui actua como ella.
    logged_in_client.post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": "otra-clave-segura"}
    )

    assert logged_in_client.get(URL).status_code == 404
    assert logged_in_client.get("/api/v1/auth/me").json()["logo_version"] == ""


def test_a_gif_renamed_as_png_is_rejected_by_its_real_content(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    version = logged_in_client.get(url_me).json()["logo_version"]

    # Es un GIF de verdad, pero el archivo se llama .png y llega con tipo image/png.
    response = _upload(logged_in_client, _image(60, 40, formato="GIF"), "logo.png", "image/png")

    assert response.status_code == 422
    assert response.json()["message"] == "El logo debe ser una imagen PNG, JPG o WebP"
    assert logged_in_client.get(url_me).json()["logo_version"] == version


def test_an_image_over_25_megapixels_is_rejected_and_the_logo_stays(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    version = logged_in_client.get(url_me).json()["logo_version"]

    # 6000 x 5000 = 30 megapixeles. En modo "1" (un bit por pixel) y de un solo color el PNG pesa
    # muy poco: cabe de sobra en los 5 MB, asi que lo unico que lo debe frenar son sus pixeles.
    buffer = BytesIO()
    Image.new("1", (6000, 5000)).save(buffer, "PNG")
    assert len(buffer.getvalue()) < 5 * 1024 * 1024

    response = _upload(logged_in_client, buffer.getvalue())

    assert response.status_code == 422
    assert response.json()["message"] == (
        "La imagen es demasiado grande en píxeles (máximo 25 megapíxeles, por ejemplo 5000 × 5000)"
    )
    assert logged_in_client.get(url_me).json()["logo_version"] == version


def test_a_decompression_bomb_is_rejected_with_the_pixels_message(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    version = logged_in_client.get(url_me).json()["logo_version"]

    # 20000 x 20000 = 400 megapixeles: Pillow mismo la considera una bomba y se niega a abrirla.
    buffer = BytesIO()
    Image.new("1", (20000, 20000)).save(buffer, "PNG")
    assert len(buffer.getvalue()) < 5 * 1024 * 1024

    response = _upload(logged_in_client, buffer.getvalue())

    assert response.status_code == 422
    assert "demasiado grande en píxeles" in response.json()["message"]
    assert logged_in_client.get(url_me).json()["logo_version"] == version


def test_a_phone_photo_with_exif_rotation_is_delivered_upright(logged_in_client, storage):
    # Una foto de celular: los pixeles estan acostados (100 x 50) y la etiqueta EXIF 6 dice
    # "girala 90 grados para verla derecha". Derecha, mide 50 de ancho por 100 de alto.
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation
    buffer = BytesIO()
    Image.new("RGB", (100, 50), "red").save(buffer, "JPEG", exif=exif)

    _upload(logged_in_client, buffer.getvalue(), "foto.jpg", "image/jpeg")

    response = logged_in_client.get(URL)
    assert Image.open(BytesIO(response.content)).size == (50, 100)


def test_a_jpeg_uploaded_as_png_is_stored_and_delivered_as_jpeg(logged_in_client, storage):
    # Es un JPEG de verdad, pero el archivo se llama .png y llega con tipo image/png.
    _upload(logged_in_client, _image(60, 40, formato="JPEG"), "logo.png", "image/png")

    response = logged_in_client.get(URL)

    assert response.headers["content-type"] == "image/jpeg"
    assert logged_in_client.get("/api/v1/auth/me").json()["logo_version"].endswith(".jpg")


class _StorageThatFailsToDelete(Storage):
    """El almacen real, salvo que borrar falla como cuando R2 no responde.

    Es la unica forma de probar este camino: contra R2 real no hay como provocar ese error.
    Guardar y leer siguen siendo reales.
    """

    def delete(self, key: str) -> None:
        raise ClientError({"Error": {"Code": "InternalError", "Message": "R2 no responde"}}, "DeleteObject")


def _make_deletes_fail(storage):
    app.dependency_overrides[get_storage] = lambda: _StorageThatFailsToDelete(prefix=storage.prefix)


def test_replacing_the_logo_still_succeeds_if_deleting_the_old_file_fails(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    primera = logged_in_client.get(url_me).json()["logo_version"]
    _make_deletes_fail(storage)

    response = _upload(logged_in_client, _image(80, 50))

    # El logo nuevo ya quedo guardado: el usuario no debe ver un error por un archivo viejo que sobra.
    assert response.status_code == 204
    assert logged_in_client.get(url_me).json()["logo_version"] != primera


def test_removing_the_logo_still_succeeds_if_deleting_the_file_fails(logged_in_client, storage):
    url_me = "/api/v1/auth/me"
    _upload(logged_in_client, _image(60, 40))
    _make_deletes_fail(storage)

    response = logged_in_client.delete(URL, headers=_csrf_headers(logged_in_client))

    assert response.status_code == 204
    assert logged_in_client.get(url_me).json()["logo_version"] == ""
