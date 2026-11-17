"""Comando de consola para restablecer la password de un usuario.

No hay "olvide mi contrasena" en el MVP: si un cliente la olvida, se le pone
una nueva desde aqui y se le entrega a mano.

Uso:
    python -m app.reset_password

El correo y la password nueva se piden por la terminal.
"""

import getpass

from sqlmodel import Session

from app.core.database import engine
from app.core.errors import AppError
from app.core.logger import logger
from app.modules.users import service


def reset_password() -> None:
    email = input("Correo del usuario: ").strip()
    # Se pide dos veces porque getpass no muestra lo que escribes: asi un error
    # de tecleo no deja al usuario con una password que nadie conoce.
    new_password = getpass.getpass("Password nueva: ")
    confirmation = getpass.getpass("Repite la password nueva: ")

    if new_password != confirmation:
        logger.error("Las passwords no coinciden. No se cambio nada.")
        raise SystemExit(1)

    with Session(engine) as session:
        try:
            service.reset_password(session, email=email, new_password=new_password)
        except AppError as error:
            logger.error(f"No se pudo cambiar la password: {error.message}")
            raise SystemExit(1)

    logger.info(f"Password de '{email}' cambiada")


if __name__ == "__main__":
    reset_password()
