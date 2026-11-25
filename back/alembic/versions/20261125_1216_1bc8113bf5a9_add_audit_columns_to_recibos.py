"""add audit columns to recibos

Revision ID: 1bc8113bf5a9
Revises: a7bea2563bfd
Create Date: 2026-11-25 12:16:09.482175

Historia 4h. Fechas y autor en `recibos`, `recibo_lineas_items` y `recibo_lineas_fichas`.
Requiere la migracion de la historia 16h: es la que crea a «Caleb», el autor de todo lo que ya
existe. Si Caleb no existiera, el paso 3 fallaria y no quedaria nada a medias (la migracion es
transaccional).

`recibos` ya tiene `created_at` con la fecha real de cada recibo: no se toca. A los recibos que
ya existen su edicion se les pone igual a esa fecha real. Las dos tablas de lineas no tenian
ninguna fecha: ahi se usa el momento de la migracion.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1bc8113bf5a9'
down_revision: Union[str, Sequence[str], None] = 'a7bea2563bfd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Caleb es el sistema. Se identifica por su correo, no por un id: el id cambia de una base a otra.
CALEB_EMAIL = "caleb@caleb.com"

# Constantes de este archivo (nunca vienen de un usuario): se pueden pegar en el SQL con f-string.
# Los valores (el correo) si van como parametros.
TABLAS = ["recibos", "recibo_lineas_items", "recibo_lineas_fichas"]
# Esta ya tenia `created_at`: solo le faltan el resto de las columnas.
YA_TIENEN_CREATED_AT = ["recibos"]


def _fecha() -> sa.DateTime:
    # Con zona horaria, igual que `created_at` en el resto del proyecto.
    return sa.DateTime(timezone=True)


def upgrade() -> None:
    # ---- Paso 1: agregar las columnas permitiendo vacio ------------------------------
    # Todavia no pueden ser obligatorias: las filas que ya existen no tienen valor.
    for tabla in TABLAS:
        if tabla not in YA_TIENEN_CREATED_AT:
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
        if tabla not in YA_TIENEN_CREATED_AT:
            # No se sabe cuando se creo una fila que no tenia fecha: se usa ahora.
            op.execute(sa.text(f"UPDATE {tabla} SET created_at = now()"))
        # Al crear, la edicion es igual a la creacion (en `recibos`, a su fecha real).
        op.execute(sa.text(f"UPDATE {tabla} SET updated_at = created_at"))
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
        # `recibos` ya tenia `created_at` antes de esta migracion: se queda con el.
        if tabla not in YA_TIENEN_CREATED_AT:
            op.drop_column(tabla, "created_at")
