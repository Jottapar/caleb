"""add audit columns to items and movimientos_inventario

Revision ID: aa861889b22b
Revises: 8d7e8f05838c
Create Date: 2026-11-25 11:37:48.205317

Historia 3i. Fechas y autor en `items` y `movimientos_inventario`. Requiere la migracion de la
historia 16h: es la que crea a «Caleb», el autor de todo lo que ya existe. Si Caleb no existiera,
el paso 3 fallaria y no quedaria nada a medias (la migracion es transaccional).

`movimientos_inventario` ya tiene `fecha` (cuando ocurrio el movimiento). Esa columna no se toca,
pero como se llena al guardar la fila, sirve de `created_at` y `updated_at` de lo que ya existe:
asi se conserva el historial de los movimientos. `items` no tiene ninguna fecha: se usa ahora.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa861889b22b'
down_revision: Union[str, Sequence[str], None] = '8d7e8f05838c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Caleb es el sistema. Se identifica por su correo, no por un id: el id cambia de una base a otra.
CALEB_EMAIL = "caleb@caleb.com"

# Constantes de este archivo (nunca vienen de un usuario): se pueden pegar en el SQL con f-string.
# Los valores (el correo) si van como parametros.
TABLAS = ["items", "movimientos_inventario"]
# De donde sale la fecha de lo que ya existe, por tabla (tambien constantes de este archivo).
FECHA_DE_LO_EXISTENTE = {"items": "now()", "movimientos_inventario": "fecha"}


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
        # Al crear, la edicion es igual a la creacion.
        fecha = FECHA_DE_LO_EXISTENTE[tabla]
        op.execute(sa.text(f"UPDATE {tabla} SET created_at = {fecha}, updated_at = {fecha}"))
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
