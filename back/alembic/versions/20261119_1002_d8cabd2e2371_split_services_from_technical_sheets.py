"""split services from technical sheets

Revision ID: d8cabd2e2371
Revises: 8cb69034e6d7
Create Date: 2026-11-19 10:02:41.285155

El servicio pasa a ser mano de obra (solo costo) y la ficha tecnica pasa a ser el producto
que se vende (cabecera con precio e impuesto + dos tablas de lineas). Ver 06. Decisiones.md,
entrada del 2026-11-19.

Las dos tablas viejas se borran y se crean de nuevo en vez de modificarlas: la migracion
anterior (8cb69034e6d7) solo existia en desarrollo y no hay datos que conservar. Si alguna
de las dos tiene filas, la migracion se detiene antes de borrar nada.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # autogenerate escribe tipos como sqlmodel.sql.sqltypes.AutoString()


# revision identifiers, used by Alembic.
revision: str = 'd8cabd2e2371'
down_revision: Union[str, Sequence[str], None] = '8cb69034e6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Freno de seguridad: borrar tablas con datos en QA o produccion seria irreversible.
    bind = op.get_bind()
    for tabla in ("fichas_tecnicas", "servicios"):
        filas = bind.execute(sa.text(f"SELECT count(*) FROM {tabla}")).scalar()
        if filas:
            raise RuntimeError(
                f"La tabla {tabla} tiene {filas} fila(s). Esta migracion la borra y la crea de "
                "nuevo, asi que se detiene para no perder datos. Hace falta una migracion de datos."
            )

    # fichas_tecnicas primero: tenia una llave foranea hacia servicios
    op.drop_table('fichas_tecnicas')
    op.drop_table('servicios')

    op.create_table('servicios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('empresa_id', sa.Integer(), nullable=False),
    sa.Column('codigo', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
    sa.Column('nombre', sqlmodel.sql.sqltypes.AutoString(length=150), nullable=False),
    sa.Column('costo', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('activo', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('fichas_tecnicas',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('empresa_id', sa.Integer(), nullable=False),
    sa.Column('codigo', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
    sa.Column('nombre', sqlmodel.sql.sqltypes.AutoString(length=150), nullable=False),
    sa.Column('precio_venta', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('impuesto_id', sa.Integer(), nullable=False),
    sa.Column('activo', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ),
    sa.ForeignKeyConstraint(['impuesto_id'], ['impuestos.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # Las lineas se crean despues de la cabecera porque la apuntan con una llave foranea
    op.create_table('fichas_tecnicas_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('empresa_id', sa.Integer(), nullable=False),
    sa.Column('ficha_tecnica_id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('cantidad', sa.Numeric(precision=14, scale=4), nullable=False),
    sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ),
    sa.ForeignKeyConstraint(['ficha_tecnica_id'], ['fichas_tecnicas.id'], ),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('fichas_tecnicas_servicios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('empresa_id', sa.Integer(), nullable=False),
    sa.Column('ficha_tecnica_id', sa.Integer(), nullable=False),
    sa.Column('servicio_id', sa.Integer(), nullable=False),
    sa.Column('cantidad', sa.Numeric(precision=14, scale=4), nullable=False),
    sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ),
    sa.ForeignKeyConstraint(['ficha_tecnica_id'], ['fichas_tecnicas.id'], ),
    sa.ForeignKeyConstraint(['servicio_id'], ['servicios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Orden inverso al de upgrade: primero lo que tiene llaves foraneas hacia otras tablas
    op.drop_table('fichas_tecnicas_servicios')
    op.drop_table('fichas_tecnicas_items')
    op.drop_table('fichas_tecnicas')
    op.drop_table('servicios')

    # Se recrea la estructura de 8cb69034e6d7: servicio con precio e impuesto, y la ficha
    # como una fila por cada insumo que consume el servicio.
    op.create_table('servicios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('empresa_id', sa.Integer(), nullable=False),
    sa.Column('codigo', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
    sa.Column('nombre', sqlmodel.sql.sqltypes.AutoString(length=150), nullable=False),
    sa.Column('precio_venta', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('impuesto_id', sa.Integer(), nullable=False),
    sa.Column('activo', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ),
    sa.ForeignKeyConstraint(['impuesto_id'], ['impuestos.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('fichas_tecnicas',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('empresa_id', sa.Integer(), nullable=False),
    sa.Column('servicio_id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('cantidad', sa.Numeric(precision=14, scale=4), nullable=False),
    sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
    sa.ForeignKeyConstraint(['servicio_id'], ['servicios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
