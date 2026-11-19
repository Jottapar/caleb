import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { TechnicalSheet, TechnicalSheetCreate } from "../types";

type UpdateVariables = {
  id: number;
  data: TechnicalSheetCreate;
};

export function useUpdateTechnicalSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    // PUT y no PATCH: se manda la ficha completa y el backend reemplaza sus lineas.
    mutationFn: ({ id, data }: UpdateVariables) =>
      api
        .put<TechnicalSheet>(`/technical-sheets/${id}`, data)
        .then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-sheets"] });
    },
  });
}
