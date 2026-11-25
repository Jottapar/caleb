"""add audit columns to servicios and fichas tecnicas

Revision ID: a7bea2563bfd
Revises: aa861889b22b
Create Date: 2026-11-25 12:03:21.774518

Historia 7e. Fechas y autor en `servicios`, `fichas_tecnicas`, `fichas_tecnicas_items` y
`fichas_tecnicas_servicios`. Requiere la migracion de la historia 16h: es la que crea a «Caleb»,
el autor de todo lo que ya existe. Si Caleb no existiera, el paso 3 fallaria y no quedaria nada
a medias (la migracion es transaccional).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7bea2563bfd'
down_revision: Union[str, Sequence[str], None] = 'aa861889b22b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Caleb es el sistema. Se identifica por su correo, no por un id: el id cambia de una base a otra.
CALEB_EMAIL = "caleb@caleb.com"

# Constantes de este archivo (nunca vienen de un usuario): se pueden pegar en el SQL con f-string.
# Los valores (el correo) si van como parametros.
TABLAS = [
    "servicios",
    "fichas_tecnicas",
    "fichas_tecnicas_items",
    "fichas_tecnicas_servicios",
]


def _fecha() -> sa.DateTime:
    # Con zona horaria, igual que `created_at` en el resto del proyecto.
    return sa.DateTime(timezone=True)


def upgrade() -> None:
    # ---- Paso 1: agregar las columnas permitiendo vacio ------------------------------
    # Todavia no pueden ser obligatorias: las filas que ya existen no tienen valor.
    for tabla in TABLAS:
        op.add_column(tabla, sa.Column("created_at", _fecha(), nullable=True))
        op.add_column(tabla, sa.Column("updated_at", _fecha(), nullable=True))
        # El ForeignKey crea la restriccion `<tabla>_<columna>_fkey`, igual que `create_all`.
        op.add_column(
            tabla, sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True)
        )
        op.add_column(
            tabla, sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True)
        )

    # ---- Paso 2: llenar lo que ya existe ---------------------------------------------
    for tabla in TABLAS:
        # No se sabe cuando se creo una fila que no tenia fecha: se usa ahora. Al crear, la
        # edicion es igual a la creacion.
        op.execute(sa.text(f"UPDATE {tabla} SET created_at = now(), updated_at = now()"))
        # No se sabe quien hizo lo que ya existia: el autor es Caleb.
        op.execute(
            sa.text(
                f"""
                UPDATE {tabla}
                SET created_by_id = (SELECT id FROM usuarios WHERE email = :email),
                    updated_by_id = (SELECT id FROM usuarios WHERE email = :email)
                """
            ).bindparams(email=CALEB_EMAIL)
        )

    # ---- Paso 3: pasar las columnas a obligatorias -----------------------------------
    for tabla in TABLAS:
        op.alter_column(tabla, "created_at", existing_type=_fecha(), nullable=False)
        op.alter_column(tabla, "updated_at", existing_type=_fecha(), nullable=False)
        op.alter_column(tabla, "created_by_id", existing_type=sa.Integer(), nullable=False)
        op.alter_column(tabla, "updated_by_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    # Al quitar las columnas desaparecen tambien sus llaves foraneas hacia `usuarios`.
    for tabla in TABLAS:
        op.drop_column(tabla, "updated_by_id")
        op.drop_column(tabla, "created_by_id")
        op.drop_column(tabla, "updated_at")
        op.drop_column(tabla, "created_at")
