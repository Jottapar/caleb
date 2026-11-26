import { useMutation } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";

type ResetVariables = {
  id: number;
  new_password: string;
};

// El Admin le pone una contraseña nueva a otro usuario de su empresa (POST /users/{id}/password).
// Recibe el id del usuario y la nueva; el backend responde 204 sin cuerpo. No toca la lista de
// usuarios: la contraseña no sale en ella.
export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, new_password }: ResetVariables) =>
      api.post(`/users/${id}/password`, { new_password }),
  });
}
