# Imagen del backend para QA y produccion. Dev sigue corriendo con Uvicorn
# directo en la maquina de Johan (ver AGENTS.md), este Dockerfile no se usa ahi.
FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

EXPOSE 8000

# Sincrono a proposito (ver 06. Decisiones): un solo worker alcanza para el
# trafico del MVP. Sin --reload: eso es solo para desarrollo.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
