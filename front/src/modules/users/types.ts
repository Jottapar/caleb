// Los tres roles que acepta el backend. Mientras no lleguen los permisos por rol (historia 16e),
// los tres pueden hacer lo mismo.
export type UserRole = "admin" | "usuario" | "contador";

// Lo que se manda a POST /users (UserCreate en el backend)
export type UserCreate = {
  nombre: string;
  email: string;
  rol: UserRole;
  password: string; // → "clave-de-maria" (la contraseña inicial; el Admin se la entrega a mano)
};

// Tal como lo devuelve POST /users (UserRead en el backend). Nunca trae la contraseña.
export type User = {
  id: number;
  nombre: string;
  email: string;
  rol: UserRole;
  activo: boolean;
};
