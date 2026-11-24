import { useMutation } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { User, UserCreate } from "../types";

// Crea un usuario en la empresa de quien hace la petición. El listado de usuarios llega en la
// historia 16b; cuando exista, aquí se invalida su caché para que el usuario nuevo aparezca.
export function useCreateUser() {
  return useMutation({
    mutationFn: (data: UserCreate) =>
      api.post<User>("/users", data).then((response) => response.data),
  });
}
