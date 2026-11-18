// "Pérez" → "perez": asi "perez", "PEREZ" y "Pérez" se encuentran entre si al buscar.
export function normalizeText(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
