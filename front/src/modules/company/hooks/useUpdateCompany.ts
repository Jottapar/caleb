import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Company } from "../types";

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Company) =>
      api.patch<Company>("/company", data).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      // El nombre del encabezado sale de GET /auth/me (modulo auth), no de /company:
      // sin esto el encabezado mostraria el nombre viejo hasta recargar la pagina.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
