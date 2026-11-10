import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Health } from "../types";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<Health>("/health").then((response) => response.data),
    // Un estado de salud viejo no sirve de nada: se vuelve a pedir siempre
    staleTime: 0,
    // Si la base esta caida queremos saberlo ya, no despues de tres reintentos
    retry: false,
  });
}
