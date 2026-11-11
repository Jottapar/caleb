import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Receipt } from "../types";

export function useAccountsReceivable() {
  return useQuery({
    queryKey: ["receipts", "accounts-receivable"],
    queryFn: () =>
      api.get<Receipt[]>("/receipts/accounts-receivable").then((response) => response.data),
  });
}
