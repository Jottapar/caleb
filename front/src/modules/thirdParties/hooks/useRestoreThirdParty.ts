import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { ThirdParty } from "../types";

export function useRestoreThirdParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.post<ThirdParty>(`/third-parties/${id}/restore`).then((response) => response.data),
    onSuccess: () => {
      // Refresca la lista normal y la de soft eliminados (las dos empiezan con "third-parties").
      queryClient.invalidateQueries({ queryKey: ["third-parties"] });
    },
  });
}
