export type LoginRequest = {
  email: string;
  password: string;
};

// Tal como lo devuelve GET /auth/me (MeRead en el backend)
export type Me = {
  user_name: string;
  company_name: string;
  logo_version: string; // → "empresas/1/logo-ab12.png" ('' si la empresa no tiene logo)
};
