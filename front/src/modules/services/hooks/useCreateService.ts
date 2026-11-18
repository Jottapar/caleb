import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Service, ServiceCreate } from "../types";

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ServiceCreate) =>
      api.post<Service>("/services", data).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}
