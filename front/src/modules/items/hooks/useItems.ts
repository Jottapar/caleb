import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Item } from "../types";

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: () => api.get<Item[]>("/items").then((response) => response.data),
  });
}
