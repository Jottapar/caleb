import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Item } from "../types";

type AddStockVariables = {
  id: number;
  cantidad: string;
};

export function useAddStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, cantidad }: AddStockVariables) =>
      api.post<Item>(`/items/${id}/stock-movements`, { cantidad }).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
