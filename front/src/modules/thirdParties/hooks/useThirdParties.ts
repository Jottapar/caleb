import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { ThirdParty } from "../types";

export function useThirdParties() {
  return useQuery({
    queryKey: ["third-parties"],
    queryFn: () => api.get<ThirdParty[]>("/third-parties").then((response) => response.data),
  });
}
