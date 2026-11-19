// Cómo se escribe en pantalla lo que el backend guarda. En la base los valores siguen siendo
// `contado`/`credito` y `emitido`/`anulado`; solo cambia lo que el usuario lee.
// Un valor desconocido se muestra tal cual.

const CONDICION_LABEL: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito",
};

const ESTADO_LABEL: Record<string, string> = {
  emitido: "Activo",
  anulado: "Cancelado",
};

export function condicionLabel(condicion: string) {
  return CONDICION_LABEL[condicion] ?? condicion;
}

export function estadoLabel(estado: string) {
  return ESTADO_LABEL[estado] ?? estado;
}

// Verde para un recibo activo, rojo para uno cancelado, para que se note de un vistazo.
export function estadoColor(estado: string) {
  return estado === "anulado" ? "red" : "green";
}
