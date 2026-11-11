import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Receipt, ReceiptCartLine } from "../types";

type CreateReceiptInput = {
  terceroId: number;
  lineas: ReceiptCartLine[];
  condicion: string;
  fechaVencimiento?: string;
};

export function useCreateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ terceroId, lineas, condicion, fechaVencimiento }: CreateReceiptInput) =>
      api
        .post<Receipt>("/receipts", {
          tercero_id: terceroId,
          lineas: lineas.map((linea) => ({ item_id: linea.itemId, cantidad: linea.cantidad })),
          condicion,
          fecha_vencimiento: condicion === "credito" ? fechaVencimiento : undefined,
        })
        .then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      // el recibo descuenta inventario: las existencias de /items quedan obsoletas
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
