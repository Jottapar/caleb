// Tal como lo devuelve GET/POST /services (ServiceRead en el backend).
// Un servicio es mano de obra: solo tiene costo, no precio de venta ni impuesto.
export type Service = {
  id: number;
  codigo: string; // → "S-0001", lo genera el backend
  nombre: string;
  costo: string; // → "8000.00"
  activo: boolean;
};

export type ServiceCreate = {
  nombre: string;
  costo: string;
};
