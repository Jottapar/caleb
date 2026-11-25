import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { User, UserUpdate } from "../types";

type UpdateVariables = {
  id: number;
  data: UserUpdate;
};

// Edita un usuario de la empresa (nombre, correo, rol o estado). Al guardar, invalida la lista de
// usuarios para que React Query la vuelva a pedir y muestre los datos nuevos.
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateVariables) =>
      api.patch<User>(`/users/${id}`, data).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
