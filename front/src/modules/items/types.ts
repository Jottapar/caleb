// Tal como lo devuelve GET/POST /items (ItemRead en el backend)
export type Item = {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  costo: string;
  precio_venta: string;
  impuesto_id: number;
  se_vende: boolean;
  es_insumo: boolean;
  activo: boolean;
  existencias: string;
};

export type ItemCreate = {
  nombre: string;
  impuesto_id: number;
  codigo?: string;
  costo?: string;
  precio_venta?: string;
  cantidad_inicial?: string;
};

export type ItemUpdate = {
  nombre?: string;
  costo?: string;
  precio_venta?: string;
  impuesto_id?: number;
  activo?: boolean;
};
