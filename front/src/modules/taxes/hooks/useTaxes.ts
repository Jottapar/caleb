import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Tax } from "../types";

export function useTaxes() {
  return useQuery({
    queryKey: ["taxes"],
    queryFn: () => api.get<Tax[]>("/taxes").then((response) => response.data),
  });
}
