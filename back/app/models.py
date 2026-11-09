"""Registro de modelos.

Alembic y los tests importan este modulo para que SQLModel.metadata conozca
todas las tablas del proyecto. Cada modelo nuevo se importa aqui; si no,
`alembic revision --autogenerate` no lo detecta y la migracion sale vacia.

Todavia no hay modelos: las tablas empresas, usuarios y usuarios_empresas
entran con la historia #1.
"""
