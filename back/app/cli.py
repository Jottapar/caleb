"""Comando de consola del proyecto.

No hay registro publico en el MVP: la empresa y su usuario propietario se
crean desde aqui, a mano, por cada cliente nuevo.

Uso:
    python -m app.cli

Los datos (empresa, propietario, correo y password) se piden por la terminal.
"""

import getpass

from sqlmodel import Session

from app.core.database import engine
from app.core.errors import AppError
from app.core.logger import logger
from app.modules.users import service


def create_company() -> None:
    # input() muestra lo que escribes; getpass() no lo muestra (para la password).
    company = input("Nombre de la empresa: ").strip()
    owner = input("Nombre del propietario: ").strip()
    email = input("Correo del propietario: ").strip()
    password = getpass.getpass("Password del propietario: ")

    with Session(engine) as session:
        try:
            service.create_company_with_owner(
                session,
                company_name=company,
                owner_name=owner,
                email=email,
                password=password,
            )
        except AppError as error:
            logger.error(f"No se pudo crear la empresa: {error.message}")
            raise SystemExit(1)

    logger.info(f"Empresa '{company}' creada con el usuario propietario '{email}'")


if __name__ == "__main__":
    create_company()
