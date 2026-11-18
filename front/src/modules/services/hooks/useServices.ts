import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Service } from "../types";

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => api.get<Service[]>("/services").then((response) => response.data),
  });
}
