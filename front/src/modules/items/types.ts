import type { TechnicalSheet } from "../technicalSheets";

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
  // Calculado por el backend: si ya tiene entradas o salidas de inventario (entonces no se elimina)
  tiene_movimientos: boolean;
};

export type ItemCreate = {
  nombre: string;
  impuesto_id: number;
  codigo?: string;
  costo?: string;
  precio_venta?: string;
  cantidad_inicial?: string;
  se_vende?: boolean;
  es_insumo?: boolean;
};

export type ItemUpdate = {
  nombre?: string;
  codigo?: string;
  costo?: string;
  precio_venta?: string;
  impuesto_id?: number;
  se_vende?: boolean;
  es_insumo?: boolean;
  activo?: boolean;
};

export type StockCartLine = {
  itemId: number;
  nombre: string;
  cantidad: string;
};

// Una fila de la tabla de Productos: puede ser un producto o una ficha tecnica.
// `kind` dice cual es, y TypeScript deja leer los campos de cada uno solo despues de revisarlo.
export type ProductRow = { kind: "item"; item: Item } | { kind: "sheet"; sheet: TechnicalSheet };
