import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";

export function useDeleteThirdParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/third-parties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["third-parties"] });
    },
  });
}
