import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { User, UserCreate } from "../types";

// Crea un usuario en la empresa de quien hace la petición. Al guardar, invalida la lista de
// usuarios: React Query la vuelve a pedir y el usuario nuevo aparece sin recargar la página.
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserCreate) =>
      api.post<User>("/users", data).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
