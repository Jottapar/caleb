from functools import lru_cache
from typing import Annotated

import boto3
from botocore.exceptions import ClientError
from fastapi import Depends

from app.core.config import settings


class Storage:
    """El almacen de archivos: el bucket de Cloudflare R2 del entorno.

    R2 habla el protocolo de S3, por eso se usa boto3. `prefix` es una carpeta dentro del bucket:
    todo lo que se guarda, se lee o se borra queda bajo ella. En produccion va vacio; los tests
    usan una carpeta propia para no tocar lo que hay en el bucket.
    """

    def __init__(self, prefix: str = ""):
        self.prefix = prefix
        self.bucket = settings.R2_BUCKET
        # Sincrono, como todo el backend. boto3 reutiliza las conexiones por dentro.
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",  # R2 no tiene regiones; "auto" es lo que pide Cloudflare
        )

    def save(self, key: str, data: bytes, content_type: str) -> None:
        """Guarda `data` con el nombre `key`. Si ya existia uno con ese nombre, lo reemplaza."""
        self.client.put_object(
            Bucket=self.bucket,
            Key=self.prefix + key,
            Body=data,
            ContentType=content_type,
        )

    def read(self, key: str) -> bytes | None:
        """Devuelve el contenido del archivo `key`, o None si no existe."""
        try:
            respuesta = self.client.get_object(Bucket=self.bucket, Key=self.prefix + key)
        except ClientError as error:
            if error.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise  # cualquier otro fallo (llaves malas, sin red) no es "no existe"
        return respuesta["Body"].read()

    def delete(self, key: str) -> None:
        """Borra el archivo `key`. Si no existe, no pasa nada."""
        self.client.delete_object(Bucket=self.bucket, Key=self.prefix + key)

    def delete_all(self) -> None:
        """Borra todo lo que haya bajo el prefijo. Solo lo usan los tests para limpiar su carpeta."""
        paginas = self.client.get_paginator("list_objects_v2").paginate(
            Bucket=self.bucket, Prefix=self.prefix
        )
        for pagina in paginas:
            for objeto in pagina.get("Contents", []):
                self.client.delete_object(Bucket=self.bucket, Key=objeto["Key"])


@lru_cache
def get_storage() -> Storage:
    """El almacen de la app, sin prefijo. Se crea una sola vez y se reutiliza en todas las peticiones.

    Crear el cliente de boto3 es caro (carga modelos y abre un pool de conexiones), y reutilizarlo
    es lo que permite mantener abiertas las conexiones con R2. Es una funcion aparte para que los
    tests la sustituyan por un almacen con carpeta propia.
    """
    return Storage()


# Alias para no repetir Depends(get_storage) en cada endpoint
StorageDep = Annotated[Storage, Depends(get_storage)]
