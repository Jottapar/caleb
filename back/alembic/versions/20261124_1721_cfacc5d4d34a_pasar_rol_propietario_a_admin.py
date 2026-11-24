"""pasar rol propietario a admin

Revision ID: cfacc5d4d34a
Revises: ad8b99197c68
Create Date: 2026-11-24 17:21:44.953895

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # autogenerate escribe tipos como sqlmodel.sql.sqltypes.AutoString()


# revision identifiers, used by Alembic.
revision: str = 'cfacc5d4d34a'
down_revision: Union[str, Sequence[str], None] = 'ad8b99197c68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Solo cambian datos, no la forma de la tabla: `rol` sigue siendo varchar(20) y su default
# vive en Python, asi que Alembic no vio ninguna diferencia de esquema.
# Rol viejo -> rol nuevo. En la practica solo existe `propietario` (lo crea el comando de
# consola); los otros dos viejos se mapean por si alguna base tiene alguno.
ROLES_VIEJO_A_NUEVO = {
    "propietario": "admin",
    "administrador": "admin",
    "vendedor": "usuario",
}


def upgrade() -> None:
    """Pasa los roles viejos a admin / usuario. `contador` ya era valido y no se toca."""
    for viejo, nuevo in ROLES_VIEJO_A_NUEVO.items():
        # Un UPDATE por rol viejo; `:viejo` y `:nuevo` van como parametros, no pegados al texto.
        op.execute(
            sa.text("UPDATE usuarios_empresas SET rol = :nuevo WHERE rol = :viejo").bindparams(
                nuevo=nuevo, viejo=viejo
            )
        )


def downgrade() -> None:
    """Devuelve los roles al nombre viejo.

    No es una vuelta exacta: despues de esta migracion se pueden haber creado admins nuevos
    desde la pantalla, y todos vuelven como `propietario`. Aceptable: el downgrade es para
    deshacer un despliegue, no para conservar la historia de roles.
    """
    for viejo, nuevo in [("propietario", "admin"), ("vendedor", "usuario")]:
        op.execute(
            sa.text("UPDATE usuarios_empresas SET rol = :viejo WHERE rol = :nuevo").bindparams(
                viejo=viejo, nuevo=nuevo
            )
        )
