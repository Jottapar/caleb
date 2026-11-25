"""add audit columns and caleb system user

Revision ID: b9c4d01b74cf
Revises: cfacc5d4d34a
Create Date: 2026-11-25 11:05:42.318456

Historia 16h. Fechas y autor en `usuarios`, `usuarios_empresas` y `empresas`, y solo las dos
fechas en `bancos` e `impuestos`. Se crea el usuario del sistema «Caleb», autor de todo lo
que ya existe. Los tres pasos van en este orden porque las columnas nuevas son obligatorias
y la base ya tiene filas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9c4d01b74cf'
down_revision: Union[str, Sequence[str], None] = 'cfacc5d4d34a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Caleb es el sistema. Se identifica por su correo, no por un id: el id cambia de una base a otra.
CALEB_EMAIL = "caleb@caleb.com"

# Los nombres de tabla son constantes de este archivo (nunca vienen de un usuario), por eso se
# pueden pegar en el SQL con f-string. Los valores (el correo) sí van como parametros.
TABLAS_CON_AUTOR = ["usuarios", "usuarios_empresas", "empresas"]
TABLAS_SOLO_FECHAS = ["bancos", "impuestos"]
TODAS = TABLAS_CON_AUTOR + TABLAS_SOLO_FECHAS
# Estas dos ya tenian `created_at`: solo les falta el resto.
YA_TIENEN_CREATED_AT = ["usuarios", "empresas"]


def _fecha() -> sa.DateTime:
    # Con zona horaria, igual que `created_at` en el resto del proyecto.
    return sa.DateTime(timezone=True)


def upgrade() -> None:
    # ---- Paso 1: agregar las columnas permitiendo vacio ------------------------------
    # Todavia no pueden ser obligatorias: las filas que ya existen no tienen valor.
    for tabla in TODAS:
        if tabla not in YA_TIENEN_CREATED_AT:
            op.add_column(tabla, sa.Column("created_at", _fecha(), nullable=True))
        op.add_column(tabla, sa.Column("updated_at", _fecha(), nullable=True))
    for tabla in TABLAS_CON_AUTOR:
        # El ForeignKey crea la restriccion `<tabla>_<columna>_fkey`, igual que `create_all`.
        op.add_column(
            tabla, sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True)
        )
        op.add_column(
            tabla, sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True)
        )

    # ---- Paso 2: llenar lo que ya existe ---------------------------------------------
    # Caleb es su propio autor, pero su id solo se conoce al insertarlo: se pide el siguiente
    # de la secuencia y se usa en las tres columnas dentro de un solo INSERT.
    op.execute(
        sa.text(
            """
            WITH siguiente AS (SELECT nextval(pg_get_serial_sequence('usuarios', 'id')) AS id)
            INSERT INTO usuarios
                (id, nombre, email, password_hash, activo,
                 created_at, updated_at, created_by_id, updated_by_id)
            SELECT id, 'Caleb', :email, '!', false, now(), now(), id, id
            FROM siguiente
            """
        ).bindparams(email=CALEB_EMAIL)
    )
    for tabla in TODAS:
        # No se sabe cuando se creo una fila de una tabla que no tenia fecha: se usa ahora.
        op.execute(sa.text(f"UPDATE {tabla} SET created_at = now() WHERE created_at IS NULL"))
        # Al crear, la edicion es igual a la creacion.
        op.execute(sa.text(f"UPDATE {tabla} SET updated_at = created_at WHERE updated_at IS NULL"))
    for tabla in TABLAS_CON_AUTOR:
        # No se sabe quien hizo lo que ya existia: el autor es Caleb. Caleb ya tiene el suyo.
        op.execute(
            sa.text(
                f"""
                UPDATE {tabla}
                SET created_by_id = (SELECT id FROM usuarios WHERE email = :email),
                    updated_by_id = (SELECT id FROM usuarios WHERE email = :email)
                WHERE created_by_id IS NULL
                """
            ).bindparams(email=CALEB_EMAIL)
        )

    # ---- Paso 3: pasar las columnas a obligatorias -----------------------------------
    for tabla in TODAS:
        op.alter_column(tabla, "created_at", existing_type=_fecha(), nullable=False)
        op.alter_column(tabla, "updated_at", existing_type=_fecha(), nullable=False)
    for tabla in TABLAS_CON_AUTOR:
        op.alter_column(tabla, "created_by_id", existing_type=sa.Integer(), nullable=False)
        op.alter_column(tabla, "updated_by_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    # Primero las columnas de autor: asi ninguna fila apunta ya a Caleb y se puede borrar.
    for tabla in TABLAS_CON_AUTOR:
        op.drop_column(tabla, "updated_by_id")
        op.drop_column(tabla, "created_by_id")
    for tabla in TODAS:
        op.drop_column(tabla, "updated_at")
        # `usuarios` y `empresas` ya tenian `created_at` antes de esta migracion: se quedan con el.
        if tabla not in YA_TIENEN_CREATED_AT:
            op.drop_column(tabla, "created_at")
    op.execute(sa.text("DELETE FROM usuarios WHERE email = :email").bindparams(email=CALEB_EMAIL))
