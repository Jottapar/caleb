// Las mismas reglas que valida el backend (app/core/validators.py). El backend es la
// regla; esto sirve para avisar antes de enviar.
export const FORMATO_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// [0-9] y no \d: \d tambien acepta digitos de otros alfabetos.
export const SOLO_DIGITOS = /^[0-9]+$/;
