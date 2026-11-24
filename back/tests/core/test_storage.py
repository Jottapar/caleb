from uuid import uuid4

import pytest

from app.core.storage import Storage


@pytest.fixture
def storage():
    """El almacen real (bucket caleb-dev de R2), con una carpeta propia para este test.

    Cada test escribe dentro de `tests/<id-aleatorio>/`, asi no toca lo que haya en el bucket ni
    lo que escriban otros tests. Al terminar se borra todo lo que haya quedado en esa carpeta.
    """
    almacen = Storage(prefix=f"tests/{uuid4().hex}/")
    yield almacen
    almacen.delete_all()


def test_storage_saves_reads_and_deletes_a_file(storage):
    storage.save("hola.txt", b"contenido de prueba", "text/plain")

    assert storage.read("hola.txt") == b"contenido de prueba"

    storage.delete("hola.txt")

    assert storage.read("hola.txt") is None
