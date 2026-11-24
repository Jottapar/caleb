import re

# Algo, una arroba, algo, un punto y algo, sin espacios: `nombre@dominio.com`.
# No intenta ser perfecto (eso solo lo confirma enviar un correo); atrapa los errores de tecleo.
FORMATO_CORREO = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
# [0-9] y no \d: \d tambien acepta digitos de otros alfabetos, como "٣".
SOLO_DIGITOS = re.compile(r"[0-9]+")
