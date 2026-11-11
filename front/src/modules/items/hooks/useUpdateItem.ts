import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Item, ItemUpdate } from "../types";

type UpdateVariables = {
  id: number;
  data: ItemUpdate;
};

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateVariables) =>
      api.patch<Item>(`/items/${id}`, data).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
