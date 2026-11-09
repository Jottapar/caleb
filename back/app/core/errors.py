class AppError(Exception):
    """Base de todos los errores de dominio.

    Los servicios lanzan estas excepciones, no HTTPException: asi no importan
    nada de fastapi y se pueden probar sin levantar la API.
    """

    status_code = 500
    code = "app_error"

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"

    def __init__(self, entity: str, entity_id: int | str | None = None):
        suffix = f" con id {entity_id}" if entity_id is not None else ""
        super().__init__(f"{entity}{suffix} no encontrado")


class AlreadyExistsError(AppError):
    status_code = 409
    code = "already_exists"

    def __init__(self, entity: str, field: str, value: str):
        super().__init__(f"{entity} con {field}={value} ya existe")


class BusinessError(AppError):
    status_code = 422
    code = "business_error"


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class ExternalServiceError(AppError):
    status_code = 502
    code = "external_service_error"
