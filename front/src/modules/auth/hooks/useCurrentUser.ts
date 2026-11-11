import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Me } from "../types";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/auth/me").then((response) => response.data),
    // Un 401 aqui significa "no hay sesion": no tiene sentido reintentar.
    retry: false,
  });
}
