import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { ThirdParty } from "../types";

// Los terceros soft eliminados de la empresa, clientes y proveedores juntos: la pantalla se queda
// con los de su tipo. La clave empieza con "third-parties", así que cualquier invalidación de la
// lista normal también refresca esta.
export function useDeletedThirdParties() {
  return useQuery({
    queryKey: ["third-parties", "deleted"],
    queryFn: () =>
      api.get<ThirdParty[]>("/third-parties/deleted").then((response) => response.data),
  });
}
