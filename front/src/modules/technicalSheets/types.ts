// Tal como lo devuelve GET/POST /technical-sheets (TechnicalSheetRead en el backend)
export type TechnicalSheet = {
  id: number;
  codigo: string; // → "F-0001", lo genera el backend
  nombre: string;
  precio_venta: string;
  impuesto_id: number;
  activo: boolean;
  costo: string; // calculado por el backend con los costos actuales, no se guarda
  insumos: SheetItemLine[];
  servicios: SheetServiceLine[];
};

export type SheetItemLine = {
  item_id: number;
  codigo: string;
  nombre: string;
  cantidad: string;
  costo_unitario: string;
};

export type SheetServiceLine = {
  servicio_id: number;
  codigo: string;
  nombre: string;
  cantidad: string;
  costo_unitario: string;
};

export type TechnicalSheetCreate = {
  nombre: string;
  impuesto_id: number;
  precio_venta: string;
  insumos: { item_id: number; cantidad: string }[];
  servicios: { servicio_id: number; cantidad: string }[];
};

// Lo minimo que la ventana necesita de un producto para ofrecerlo como insumo.
// Se declara aqui y no se importa `Item` para que technicalSheets no dependa de items.
export type Supply = {
  id: number;
  codigo: string;
  nombre: string;
  costo: string;
};
