// La API manda los montos como string ("2000.00"); aqui se convierten solo para mostrarlos.
const copFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

// Hasta un decimal, pero solo si hace falta: 10 se ve "10" y 10.5 se ve "10,5".
const stockFormat = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

// "2000.00" → "2.000 COP" (la moneda va despues del numero)
export function formatCop(value: string) {
  return `${copFormat.format(Number(value))} COP`;
}

// "10.0000" → "10"  |  "10.5000" → "10,5"
export function formatStock(value: string) {
  return stockFormat.format(Number(value));
}

// Deja pasar solo digitos y un unico punto decimal, para que los inputs de cantidad, costo y precio no acepten letras.
// "1a2.5.3" → "12.53"
export function sanitizeDecimal(value: string) {
  const [entero, ...decimales] = value.replace(/[^0-9.]/g, "").split(".");
  return decimales.length > 0 ? `${entero}.${decimales.join("")}` : entero;
}
