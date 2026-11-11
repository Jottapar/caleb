import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Receipt } from "../types";

export function useReceipts() {
  return useQuery({
    queryKey: ["receipts"],
    queryFn: () => api.get<Receipt[]>("/receipts").then((response) => response.data),
  });
}
