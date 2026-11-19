import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";

export function useDeleteTechnicalSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/technical-sheets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-sheets"] });
    },
  });
}
