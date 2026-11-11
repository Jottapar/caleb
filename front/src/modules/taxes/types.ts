// Tal como lo devuelve GET /taxes (TaxRead en el backend)
export type Tax = {
  id: number;
  nombre: string;
  porcentaje: string;
  activo: boolean;
};
