export type ThirdPartyType = "cliente" | "proveedor" | "ambos";

// Tal como lo devuelve GET /third-parties (ThirdPartyRead en el backend)
export type ThirdParty = {
  id: number;
  tipo: ThirdPartyType;
  nombre: string;
  documento: string;
  email: string;
  telefono: string;
  activo: boolean;
};

export type ThirdPartyCreate = {
  tipo: ThirdPartyType;
  nombre: string;
  documento: string;
  email: string;
  telefono: string;
};
