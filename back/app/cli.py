"""Comandos de consola del proyecto.

No hay registro publico en el MVP: la empresa y su usuario propietario se
crean desde aqui, a mano, por cada cliente nuevo.

Uso:
    python -m app.cli create-company --company "Panaderia Luna" \\
        --owner "Johan" --email johan@example.com --password "una-clave-segura"
"""

import argparse

from sqlmodel import Session

from app.core.database import engine
from app.core.errors import AppError
from app.core.logger import logger
from app.modules.users import service


def create_company(args: argparse.Namespace) -> None:
    with Session(engine) as session:
        try:
            service.create_company_with_owner(
                session,
                company_name=args.company,
                owner_name=args.owner,
                email=args.email,
                password=args.password,
            )
        except AppError as error:
            logger.error(f"No se pudo crear la empresa: {error.message}")
            raise SystemExit(1)

    logger.info(f"Empresa '{args.company}' creada con el usuario propietario '{args.email}'")


def main() -> None:
    parser = argparse.ArgumentParser(description="Comandos de consola de Caleb")
    subparsers = parser.add_subparsers(required=True)

    create_company_parser = subparsers.add_parser(
        "create-company", help="Crea una empresa y su usuario propietario"
    )
    create_company_parser.add_argument("--company", required=True, help="Nombre de la empresa")
    create_company_parser.add_argument("--owner", required=True, help="Nombre del usuario propietario")
    create_company_parser.add_argument("--email", required=True, help="Correo del usuario propietario")
    create_company_parser.add_argument("--password", required=True, help="Password del usuario propietario")
    create_company_parser.set_defaults(func=create_company)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
