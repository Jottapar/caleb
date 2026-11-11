import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Item, StockCartLine } from "../types";

export function useAddStockBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lineas: StockCartLine[]) =>
      api
        .post<Item[]>("/items/stock-movements/bulk", {
          lineas: lineas.map((linea) => ({ item_id: linea.itemId, cantidad: linea.cantidad })),
        })
        .then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
