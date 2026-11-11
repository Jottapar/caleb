import { QueryClient } from "@tanstack/react-query";

// Una sola instancia para toda la app: la usan `Providers` (para que React
// renderice con ella) y el interceptor de `api.ts` (para limpiarla cuando
// la sesion se vence de verdad, sin tener que pasarla por props).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
