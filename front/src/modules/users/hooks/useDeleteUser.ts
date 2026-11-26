import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";

// Elimina de verdad a un usuario de la empresa (DELETE /users/{id}). Recibe el id del usuario y
// no devuelve nada (el backend responde 204). Al terminar, invalida la lista de usuarios para que
// React Query la vuelva a pedir y el usuario ya no aparezca.
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
