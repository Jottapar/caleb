"""add audit columns to pagos cuentas por cobrar

Revision ID: e7ea1b667a3e
Revises: 1bc8113bf5a9
Create Date: 2026-11-25 13:16:44.205837

Historia 5d. Fechas y autor en `pagos_cuentas_por_cobrar`. Requiere la migracion de la historia
16h: es la que crea a «Caleb», el autor de todo lo que ya existe. Si Caleb no existiera, el paso 3
fallaria y no quedaria nada a medias (la migracion es transaccional).

La tabla ya tiene `created_at` con la fecha real de cada pago: no se toca. A los pagos que ya
existen su edicion se les pone igual a esa fecha real.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7ea1b667a3e'
down_revision: Union[str, Sequence[str], None] = '1bc8113bf5a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Caleb es el sistema. Se identifica por su correo, no por un id: el id cambia de una base a otra.
CALEB_EMAIL = "caleb@caleb.com"

# Constante de este archivo (nunca viene de un usuario): se puede pegar en el SQL con f-string.
# Los valores (el correo) si van como parametros.
TABLA = "pagos_cuentas_por_cobrar"


def _fecha() -> sa.DateTime:
    # Con zona horaria, igual que `created_at` en el resto del proyecto.
    return sa.DateTime(timezone=True)


def upgrade() -> None:
    # ---- Paso 1: agregar las columnas permitiendo vacio ------------------------------
    # Todavia no pueden ser obligatorias: las filas que ya existen no tienen valor.
    # `created_at` no se agrega: la tabla ya lo tenia.
    op.add_column(TABLA, sa.Column("updated_at", _fecha(), nullable=True))
    # El ForeignKey crea la restriccion `<tabla>_<columna>_fkey`, igual que `create_all`.
    op.add_column(
        TABLA, sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True)
    )
    op.add_column(
        TABLA, sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True)
    )

    # ---- Paso 2: llenar lo que ya existe ---------------------------------------------
    # Al crear, la edicion es igual a la creacion (a la fecha real de cada pago).
    op.execute(sa.text(f"UPDATE {TABLA} SET updated_at = created_at"))
    # No se sabe quien hizo lo que ya existia: el autor es Caleb.
    op.execute(
        sa.text(
            f"""
            UPDATE {TABLA}
            SET created_by_id = (SELECT id FROM usuarios WHERE email = :email),
                updated_by_id = (SELECT id FROM usuarios WHERE email = :email)
            """
        ).bindparams(email=CALEB_EMAIL)
    )

    # ---- Paso 3: pasar las columnas a obligatorias -----------------------------------
    op.alter_column(TABLA, "updated_at", existing_type=_fecha(), nullable=False)
    op.alter_column(TABLA, "created_by_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column(TABLA, "updated_by_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    # Al quitar las columnas desaparecen tambien sus llaves foraneas hacia `usuarios`.
    # `created_at` se queda: la tabla ya lo tenia antes de esta migracion.
    op.drop_column(TABLA, "updated_by_id")
    op.drop_column(TABLA, "created_by_id")
    op.drop_column(TABLA, "updated_at")
