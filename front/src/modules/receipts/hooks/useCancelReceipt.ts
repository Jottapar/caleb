import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Receipt } from "../types";

export function useCancelReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (receiptId: number) =>
      api.post<Receipt>(`/receipts/${receiptId}/cancel`).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      // la cancelacion revierte el inventario descontado
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
