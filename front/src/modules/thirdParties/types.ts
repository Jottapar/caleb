export type ThirdPartyType = "cliente" | "proveedor" | "ambos";

export type AccountType = "ahorros" | "corriente";

// Tal como lo devuelve GET /banks (BankRead en el backend)
export type Bank = {
  id: number;
  nombre: string;
};

// La cuenta como la devuelve la API, con el nombre del banco ya resuelto
export type BankAccount = {
  banco_id: number;
  banco_nombre: string; // → "Bancolombia"
  tipo_cuenta: AccountType;
  numero_cuenta: string; // texto, no numero: puede empezar por cero
};

// La cuenta como se envia al crear o editar: los tres campos van juntos
export type BankAccountData = {
  banco_id: number;
  tipo_cuenta: AccountType;
  numero_cuenta: string;
};

// Tal como lo devuelve GET /third-parties (ThirdPartyRead en el backend)
export type ThirdParty = {
  id: number;
  tipo: ThirdPartyType;
  nombre: string;
  documento: string;
  email: string;
  telefono: string;
  direccion: string;
  activo: boolean;
  cuenta_bancaria: BankAccount | null;
};

export type ThirdPartyCreate = {
  tipo: ThirdPartyType;
  nombre: string;
  documento: string;
  email: string;
  telefono: string;
  direccion: string;
  // null: sin cuenta. Al editar, null borra la cuenta que hubiera.
  cuenta_bancaria: BankAccountData | null;
};
