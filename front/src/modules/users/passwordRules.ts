// Las reglas de una contraseña nueva, las mismas del backend (es quien manda), para avisar antes
// de enviar. Las comparten crear usuario, cambiar mi contraseña y restablecer la de otro.
export const MIN_LARGO_PASSWORD = 8;

// El mensaje si la contraseña es más corta que el mínimo, o undefined si el largo sirve. La
// contraseña no se recorta: los espacios de los lados cuentan, igual que en el backend.
export function passwordLengthError(password: string): string | undefined {
  return password.length < MIN_LARGO_PASSWORD
    ? `La contraseña debe tener al menos ${MIN_LARGO_PASSWORD} caracteres`
    : undefined;
}

export type NewPasswordErrors = {
  next?: string;
  confirmation?: string;
};

// Revisa la contraseña nueva y su confirmación. Devuelve un objeto vacío si todo está bien.
export function validateNewPassword(next: string, confirmation: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};
  const lengthError = passwordLengthError(next);
  if (lengthError) {
    errors.next = lengthError;
  }
  if (confirmation !== next) {
    errors.confirmation = "Las contraseñas no coinciden";
  }
  return errors;
}
