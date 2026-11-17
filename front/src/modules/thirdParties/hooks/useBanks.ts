import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Bank } from "../types";

export function useBanks() {
  return useQuery({
    queryKey: ["banks"],
    queryFn: () => api.get<Bank[]>("/banks").then((response) => response.data),
    // El catalogo de bancos casi nunca cambia: no hace falta volver a pedirlo.
    staleTime: Infinity,
  });
}
