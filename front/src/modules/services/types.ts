// Tal como lo devuelve GET/POST /services (ServiceRead en el backend)
export type Service = {
  id: number;
  codigo: string; // → "S-0001", lo genera el backend
  nombre: string;
  precio_venta: string;
  impuesto_id: number;
  activo: boolean;
  costo: string; // calculado por el backend con la ficha tecnica, no se guarda
  insumos: TechnicalSheetLine[];
};

export type TechnicalSheetLine = {
  item_id: number;
  codigo: string;
  nombre: string;
  cantidad: string;
  costo_unitario: string;
};

export type ServiceCreate = {
  nombre: string;
  impuesto_id: number;
  precio_venta: string;
  insumos: { item_id: number; cantidad: string }[];
};

// Lo minimo que la ventana necesita de un producto para ofrecerlo como insumo.
// Se declara aqui y no se importa `Item` para que services no dependa de items.
export type Supply = {
  id: number;
  codigo: string;
  nombre: string;
  costo: string;
};
