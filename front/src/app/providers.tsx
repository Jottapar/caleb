import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Una sola instancia para toda la app. Si se creara dentro del componente,
// se perderia la cache en cada render.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cuanto tiempo un dato se considera fresco antes de volver a pedirlo
      staleTime: 30_000,
      retry: 1,
    },
  },
});

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    </QueryClientProvider>
  );
}
