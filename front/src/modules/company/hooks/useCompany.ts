import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Company } from "../types";

export function useCompany() {
  return useQuery({
    queryKey: ["company"],
    queryFn: () => api.get<Company>("/company").then((response) => response.data),
  });
}
