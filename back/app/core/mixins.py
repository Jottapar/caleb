from datetime import datetime, timezone


def utc_now() -> datetime:
    """Hora actual con zona horaria UTC.

    `datetime.now()` sin zona guarda una hora "naive" que depende del
    servidor donde corra la app; con `utc_now()` siempre es comparable.
    """
    return datetime.now(timezone.utc)
