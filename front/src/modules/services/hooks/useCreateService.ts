import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Service, ServiceCreate } from "../types";

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ServiceCreate) =>
      api.post<Service>("/services", data).then((response) => response.data),
    // Se devuelve la promesa para que React Query espere a que la lista se actualice antes
    // de avisar que terminó: así quien crea un servicio lo encuentra ya en el desplegable.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });
}
