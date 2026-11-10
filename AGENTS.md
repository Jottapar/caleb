# Caleb

SaaS de administración para emprendedores nuevos en Colombia: recibos de venta internos, cuentas por
cobrar y por pagar, inventario, servicios con ficha técnica, gastos, entradas y flujo de caja
semanal. Está en **MVP**, pensado para validar con clientes reales antes de crecer.

---

## 1. La documentación del negocio NO vive en este repo

Vive en Obsidian, en:

```
/home/johan/Johan_Digital_Brain/020 🛠️ - PROJECTS/02. Caleb/
```

La nota índice es `00. Resumen.md` y enlaza a las demás: alcance, reglas de negocio, modelo de
datos, flujo de caja, stack, decisiones, versiones, pendientes y entornos.

**Esa documentación es la fuente de verdad del negocio, no el código.** Antes de implementar
cualquier regla de negocio, lee la nota correspondiente. No deduzcas una regla del código ni la
inventes: si no está escrita, pregunta.

### Regla de mantenimiento (no se salta)

Si un cambio altera el **modelo de datos** o una **regla de negocio**, el orden es:

1. Se actualiza primero la nota correspondiente en el vault.
2. Se anota la decisión en `06. Decisiones.md`, con fecha y motivo.
3. **Después** se toca el código, migración incluida.

Al revés no. Una decisión que solo existe en el código es una decisión que se va a olvidar y a
contradecir.

---

## 2. Cómo trabajamos

### Johan está aprendiendo

Este es su primer proyecto con FastAPI y React. **Explica el código que escribes**, no solo lo
entregues funcionando: qué recibe cada función, de qué tipo, qué hace y qué devuelve. Código que
funciona pero que él no entiende no le sirve, porque no lo puede mantener ni depurar solo.

Si una explicación necesita quedar guardada, va a una nota de Obsidian, no a un comentario largo en
el código.

### Quién ejecuta qué

**Johan corre él mismo** todos estos comandos. Dicta el comando, explica qué hace y qué debería
verse como resultado, y espera a que él confirme. No los ejecutes por él:

- **Git:** `add`, `status`, `commit`, `push`. Ni siquiera un `git status` de solo lectura "para
  verificar antes de commitear": esa revisión es suya, es el reflejo que está construyendo.
- **Alembic:** `alembic revision --autogenerate -m "..."` y `alembic upgrade head`. Los dos pasos,
  siempre. Entre uno y otro está el momento de leer la migración; por eso son dos.
- **Levantar cosas:** Uvicorn, Vite, `docker compose`, instalar dependencias.

**Claude sí escribe** el código de la aplicación y el contenido de los archivos de migración cuando
el autogenerate necesita arreglo (renombrados, columnas obligatorias sobre datos existentes,
cambios de tipo), explicando cada línea antes de que él lo aplique.

**Regla que no se rompe:** ninguna migración se aplica sin que los dos la hayamos leído. Da igual
quién la escribió.

### Commits

El mensaje lo escribe Johan. Si se le sugiere uno, el `Closes #N` va como trailer en la última
línea, después de una línea en blanco. Él usa lazygit: en el panel de commit, Enter hace salto de
línea y `Ctrl+S` confirma.

---

## 3. Convenciones de código

- **Backend:** la skill `fastapi-conventions`.
- **Frontend:** la skill `react-conventions`.

Esas skills son la autoridad sobre estilo, estructura y librerías. Este archivo solo manda cuando
dice algo distinto, y lo que dice distinto está abajo.

---

## 4. Reglas del proyecto que no se negocian

Cada una tiene su motivo escrito en `06. Decisiones.md`; aquí va el resumen ejecutable.

### Backend

- **Síncrono.** `def`, `Session` de SQLModel, driver `psycopg`. **Nunca `async def`.** No es una
  preferencia estética: una sola llamada bloqueante dentro de un `async def` degrada todas las
  peticiones, y el dominio está lleno de relaciones donde el lazy loading async explota.
- **Autenticación con AuthX + `pwdlib[argon2]`.** Nunca escrita a mano: ni el hash, ni la firma del
  token, ni la cookie, ni el CSRF. `JWT_COOKIE_CSRF_PROTECT` **nunca se apaga**.
  **`fastapi-users` está descartado** porque es async-only.
- **La base de datos solo cambia por migraciones de Alembic.** Nunca `create_all` en la app. La
  migración se commitea junto al cambio de modelo que la originó, y el archivo generado se **revisa
  a mano** antes de aplicarlo.
- **Tests contra PostgreSQL real** (Docker). Nunca SQLite: hay tipos de Postgres que no existe ahí y
  los tests darían falsos resultados. Nunca mocks de la base ni de los propios servicios.

### Modelo de datos

- **Lo derivado se calcula, no se guarda:** el stock (suma de `movimientos_inventario`), la deuda de
  un recibo o una compra (total menos la suma de sus pagos) y el flujo de caja semanal. Un saldo
  guardado se descuadra; uno calculado siempre cuadra.
- **Ninguna columna queda vacía.** Donde no hay dato va un default (`''` o `0`). Por eso las líneas
  de recibo están en dos tablas, no en una con columnas nulas.
- **Sin enums y sin índices por ahora.** Los valores válidos van en un comentario de la columna y
  **los valida el backend**: roles, tipos, estados, condiciones, orígenes, y la unicidad de códigos
  y números por empresa.
- **Las líneas guardan copia** del nombre, precio e impuesto al momento de vender o comprar. Si
  después cambia el precio del ítem, los documentos viejos no cambian.
- `empresa_id` en casi todas las tablas. Toda consulta filtra por la empresa del usuario.

### Alcance

- **Multiempresa, pero un usuario = una empresa** en el MVP. No hay pantalla para elegir empresa.
- **Los roles quedan para la V2.** La columna `rol` existe y se valida, pero **no hay permisos
  diferenciados**: no implementes `require_role` ni pantallas de gestión de usuarios.
- **No hay registro público.** La empresa y su usuario propietario se crean con un comando de
  consola. Tampoco hay "olvidé mi contraseña" en el MVP.
- **Sin DIAN.** El recibo de venta es un comprobante interno. La facturación electrónica es V2.
- **Solo Colombia, solo COP.** Impuestos simples.

### Nombres

- **Identificadores en inglés:** módulos, clases, funciones, variables, tablas, columnas, ramas.
- **Textos para el usuario en español:** errores de la API, validaciones, etiquetas de la interfaz.
  Los comentarios y los logs, también en español.
- **Las tablas del modelo ya están en español** (`recibos`, `items`, `terceros`). Es la convención
  del proyecto y **no se renombran**: renombrar tablas exige migraciones.

---

## 5. Ramas y entornos

| Rama | Base de datos | Dónde corre |
|---|---|---|
| `development` | Postgres local en Docker | la máquina de Johan |
| `qa` | rama `qa` en Neon | Droplet, subdominio de QA |
| `main` | rama `production` en Neon | Droplet, dominio real |

El flujo es **`development` → `qa` → `main`**. Siempre hacia adelante, siempre por merge. Nunca
`cherry-pick` para pasar un arreglo suelto a producción.

**Una migración se aplica en QA antes que en producción. Siempre.** Es la única razón de existir de
la rama `qa`.

Alembic corre contra el endpoint **directo** de Neon (sin pooler); la aplicación usa el del pooler.
El PgBouncer de Neon está en `pool_mode=transaction` y ahí no hay `SET`/`RESET` ni advisory locks de
sesión.

El procedimiento completo está en la nota `10. Entornos y Despliegue.md` del vault.

---

## 6. Estructura

```
caleb/
├── front/    # React + TypeScript + Vite
├── back/     # FastAPI
└── deploy/   # Dockerfiles, docker-compose, Nginx
```

Screaming architecture **por módulo** en los dos lados, según las skills. No organices por capa
técnica (`models/`, `services/`, `schemas/` globales).

---

## 7. Backlog

Las historias viven en GitHub: https://github.com/users/Jottapar/projects/4

**Los números de las historias no son los números de issue de GitHub.** La historia `0a` es el issue
#1, la `1` es el #6, la `14` es el #21. En las notas de Obsidian se usan los números de las historias
(`0c`, `1b`); en commits y PRs, los de GitHub (`closes #3`).

---

## 8. Commits

Conventional Commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`,
`ci:`, `chore:`. Descripción en imperativo, en minúscula, sin punto final. Si el mensaje necesita un
"y", son dos commits.
