import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { TechnicalSheet } from "../types";

type Variables = {
  id: number;
  activo: boolean;
};

export function useSetTechnicalSheetActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, activo }: Variables) =>
      api
        .patch<TechnicalSheet>(`/technical-sheets/${id}`, { activo })
        .then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-sheets"] });
    },
  });
}
