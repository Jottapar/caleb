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

export type Receipt = {
  id: number;
  tercero_id: number;
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
};

export type ReceiptCartLine = {
  itemId: number;
  nombre: string;
  cantidad: string;
};
