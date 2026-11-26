// Tal como lo devuelve GET/POST /receipts (ReceiptRead en el backend)
export type ReceiptItemLine = {
  id: number;
  item_id: number;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  impuesto_porcentaje: string;
  total_linea: string;
};

// Una ficha técnica vendida en el recibo (recibo_lineas_fichas en el backend)
export type ReceiptSheetLine = {
  id: number;
  ficha_tecnica_id: number;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  impuesto_porcentaje: string;
  total_linea: string;
};

export type Receipt = {
  id: number;
  tercero_id: number;
  cliente_nombre: string; // → "Carlos" (se conserva aunque el cliente se elimine)
  numero: string;
  fecha: string;
  condicion: string;
  fecha_vencimiento: string;
  estado: string;
  subtotal: string;
  impuestos_total: string;
  total: string;
  notas: string;
  saldo: string;
  lineas: ReceiptItemLine[];
  lineas_fichas: ReceiptSheetLine[];
};

// Una línea del carrito: un producto o una ficha técnica. El tipo (`kind`) hace falta porque un
// producto y una ficha pueden tener el mismo id.
export type ReceiptCartLine = {
  kind: "item" | "sheet";
  id: number;
  nombre: string;
  cantidad: string;
};
