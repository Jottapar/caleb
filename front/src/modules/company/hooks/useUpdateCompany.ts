import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { Company } from "../types";

// El logo fallo DESPUES de que los datos se guardaron. Es un error aparte para que la pantalla
// pueda decirle al usuario que lo demas si quedo guardado.
export class LogoSaveError extends Error {
  // El error original (el de axios), para poder leer el mensaje que mando el backend.
  original: unknown;

  constructor(original: unknown) {
    super("No se pudo guardar el logo");
    this.original = original;
  }
}

type Changes = {
  data: Company;
  // Lo que se hizo con el logo en el formulario: un archivo nuevo, "remove" para quitar el actual,
  // o null si no se toco.
  logo: File | "remove" | null;
};

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    // Los datos y el logo viajan en peticiones distintas (JSON y archivo), pero una sola mutacion:
    // asi "guardado" significa que terminaron las dos, y el error de cualquiera queda en un lugar.
    mutationFn: async ({ data, logo }: Changes) => {
      const company = await api.patch<Company>("/company", data).then((response) => response.data);
      try {
        if (logo === "remove") {
          await api.delete("/company/logo");
        } else if (logo) {
          const body = new FormData();
          body.append("file", logo);
          await api.put("/company/logo", body);
        }
      } catch (error) {
        throw new LogoSaveError(error);
      }
      return company;
    },
    // onSettled y no onSuccess: si los datos se guardaron pero el logo fallo, la cache tambien
    // quedaria vieja.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      // El nombre y el logo del encabezado salen de GET /auth/me (modulo auth), no de /company:
      // sin esto el encabezado mostraria lo viejo hasta recargar la pagina.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
