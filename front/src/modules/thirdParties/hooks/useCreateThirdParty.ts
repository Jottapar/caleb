import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { ThirdParty, ThirdPartyCreate } from "../types";

export function useCreateThirdParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ThirdPartyCreate) =>
      api.post<ThirdParty>("/third-parties", data).then((response) => response.data),
    // Se devuelve la promesa para que React Query espere a que la lista se actualice antes de
    // avisar que terminó: así quien crea un tercero lo encuentra ya en los desplegables.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["third-parties"] }),
  });
}
