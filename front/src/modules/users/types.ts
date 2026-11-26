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
  // Si figura como autor en alguna tabla con auditoría. Lo calcula el backend al listar; crear y
  // editar no lo devuelven.
  tiene_historial: boolean;
};

// Lo que se manda a PATCH /users/{id} (UserUpdate en el backend). Todo es opcional: lo que no se
// manda se queda como estaba. No incluye la contraseña: editar no la toca.
export type UserUpdate = Partial<
  Pick<User, "nombre" | "email" | "rol" | "activo">
>;
