import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { TechnicalSheet } from "../types";

export function useTechnicalSheets() {
  return useQuery({
    queryKey: ["technical-sheets"],
    queryFn: () => api.get<TechnicalSheet[]>("/technical-sheets").then((response) => response.data),
  });
}
