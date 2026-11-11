export type LoginRequest = {
  email: string;
  password: string;
};

// Tal como lo devuelve GET /auth/me (MeRead en el backend)
export type Me = {
  user_name: string;
  company_name: string;
};
