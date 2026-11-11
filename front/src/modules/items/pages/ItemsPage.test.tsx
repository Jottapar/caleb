import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { ItemsPage } from "./ItemsPage";

const ITEMS_URL = "/api/v1/items";
const TAXES_URL = "/api/v1/taxes";

const SIN_IMPUESTO = { id: 1, nombre: "Sin impuesto", porcentaje: "0.00", activo: true };

function renderPage() {
  renderWithProviders([{ path: "/", element: <ItemsPage /> }]);
}

it("muestra la lista de productos con sus existencias", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () =>
      HttpResponse.json([
        {
          id: 1,
          codigo: "HAR-001",
          nombre: "Harina de trigo",
          unidad: "und",
          costo: "2000.00",
          precio_venta: "3500.00",
          impuesto_id: 1,
          se_vende: true,
          es_insumo: false,
          activo: true,
          existencias: "10.0000",
        },
      ]),
    ),
  );

  renderPage();

  expect(await screen.findByText("Harina de trigo")).toBeInTheDocument();
  expect(screen.getByText("10.0000")).toBeInTheDocument();
});

it("registra un producto y aparece en la lista", async () => {
  let items: unknown[] = [];
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json(items)),
    http.post(ITEMS_URL, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      const creado = {
        id: 1,
        codigo: "P-0001",
        unidad: "und",
        costo: "0.00",
        precio_venta: "0.00",
        se_vende: true,
        es_insumo: false,
        activo: true,
        existencias: "0.0000",
        ...data,
      };
      items = [creado];
      return HttpResponse.json(creado, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await screen.findByRole("option", { name: "Sin impuesto" });
  await user.type(screen.getByLabelText(/nombre/i), "Harina de trigo");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("Harina de trigo")).toBeInTheDocument();
});
