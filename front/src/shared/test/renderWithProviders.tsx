import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

type RouteDef = {
  path: string;
  element: ReactNode;
};

type Options = {
  initialEntries?: string[];
};

// Rutas declarativas (no el router de datos de la app): en jsdom + MSW, el
// router de datos construye un Request internamente que choca con el
// AbortSignal de undici. Para probar useNavigate esto alcanza igual.
export function renderWithProviders(routes: RouteDef[], { initialEntries = ["/"] }: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={defaultSystem}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            {routes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>,
  );
}
