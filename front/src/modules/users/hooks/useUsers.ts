import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { User } from "../types";

// Los usuarios de la empresa de quien consulta. El backend ya los manda ordenados por nombre
// (A–Z), así que aquí no se vuelven a ordenar.
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users").then((response) => response.data),
  });
}
