import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { ThirdPartiesPage } from "./ThirdPartiesPage";

const URL = "/api/v1/third-parties";

function renderPage() {
  renderWithProviders([{ path: "/", element: <ThirdPartiesPage /> }]);
}

it("muestra la lista de terceros que devuelve la API", async () => {
  server.use(
    http.get(URL, () =>
      HttpResponse.json([
        {
          id: 1,
          tipo: "cliente",
          nombre: "Ana Pérez",
          documento: "123",
          email: "ana@example.com",
          telefono: "3001234567",
          activo: true,
        },
      ]),
    ),
  );

  renderPage();

  expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
});

it("muestra un mensaje cuando no hay terceros", async () => {
  server.use(http.get(URL, () => HttpResponse.json([])));

  renderPage();

  expect(await screen.findByText(/no tienes terceros registrados/i)).toBeInTheDocument();
});

it("registra un tercero y lo agrega a la lista", async () => {
  let terceros: unknown[] = [];
  server.use(
    http.get(URL, () => HttpResponse.json(terceros)),
    http.post(URL, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      const creado = { id: 1, documento: "", email: "", telefono: "", activo: true, ...data };
      terceros = [creado];
      return HttpResponse.json(creado, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.type(screen.getByLabelText(/nombre/i), "Carlos");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("Carlos")).toBeInTheDocument();
});

it("muestra el error del backend cuando el nombre esta vacio", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json([])),
    http.post(URL, () =>
      HttpResponse.json(
        { error: "business_error", message: "El nombre del tercero es obligatorio" },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("El nombre del tercero es obligatorio")).toBeInTheDocument();
});
