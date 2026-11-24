// Tal como lo devuelve GET /company (CompanyRead en el backend)
export type Company = {
  nombre: string;
  documento_fiscal: string; // → "9001234567" (el NIT: solo digitos, el ultimo es el de verificacion)
  direccion: string;
  telefono: string;
  email: string;
};
