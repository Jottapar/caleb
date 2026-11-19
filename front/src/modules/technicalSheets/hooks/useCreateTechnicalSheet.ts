import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { TechnicalSheet, TechnicalSheetCreate } from "../types";

export function useCreateTechnicalSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TechnicalSheetCreate) =>
      api.post<TechnicalSheet>("/technical-sheets", data).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-sheets"] });
    },
  });
}
