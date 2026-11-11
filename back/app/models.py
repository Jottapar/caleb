"""Registro de modelos.

Alembic y los tests importan este modulo para que SQLModel.metadata conozca
todas las tablas del proyecto. Cada modelo nuevo se importa aqui; si no,
`alembic revision --autogenerate` no lo detecta y la migracion sale vacia.
"""

from app.modules.companies.models import Company  # noqa: F401
from app.modules.third_parties.models import ThirdParty  # noqa: F401
from app.modules.users.models import User, UserCompany  # noqa: F401
