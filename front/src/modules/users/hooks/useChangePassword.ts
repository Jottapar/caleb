import { useMutation } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { PasswordChange } from "../types";

// Cambia la contraseña de quien tiene la sesión abierta (POST /users/me/password). Recibe la
// actual y la nueva; el backend responde 204 sin cuerpo. No toca la lista de usuarios: la
// contraseña no sale en ella.
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: PasswordChange) => api.post("/users/me/password", data),
  });
}
