import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { ReceiptsPage } from "./ReceiptsPage";

const RECEIPTS_URL = "/api/v1/receipts";
const THIRD_PARTIES_URL = "/api/v1/third-parties";
const ITEMS_URL = "/api/v1/items";

const CLIENTE = {
  id: 1,
  tipo: "cliente",
  nombre: "Cliente Uno",
  documento: "",
  email: "",
  telefono: "",
  activo: true,
};

const PRODUCTO = {
  id: 1,
  codigo: "P-0001",
  nombre: "Pan",
  unidad: "und",
  costo: "2000.00",
  precio_venta: "5000.00",
  impuesto_id: 1,
  se_vende: true,
  es_insumo: false,
  activo: true,
  existencias: "10.0000",
};

const RECIBO = {
  id: 1,
  tercero_id: 1,
  numero: "R-0001",
  fecha: "2026-11-11",
  condicion: "contado",
  fecha_vencimiento: "2026-11-11",
  estado: "emitido",
  subtotal: "10000.00",
  impuestos_total: "0.00",
  total: "10000.00",
  notas: "",
  lineas: [
    {
      id: 1,
      item_id: 1,
      descripcion: "Pan",
      cantidad: "2.0000",
      precio_unitario: "5000.00",
      impuesto_porcentaje: "0.00",
      total_linea: "10000.00",
    },
  ],
};

function renderPage() {
  renderWithProviders([{ path: "/", element: <ReceiptsPage /> }]);
}

it("muestra un mensaje cuando no hay recibos registrados todavía", async () => {
  server.use(http.get(RECEIPTS_URL, () => HttpResponse.json([])));

  renderPage();

  expect(await screen.findByText(/no tienes recibos emitidos/i)).toBeInTheDocument();
});

it("crea un recibo eligiendo un cliente y agregando un producto al carrito", async () => {
  let recibos: unknown[] = [];
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json(recibos)),
    http.post(RECEIPTS_URL, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      const creado = {
        id: 1,
        numero: "R-0001",
        fecha: "2026-11-11",
        condicion: "contado",
        fecha_vencimiento: "2026-11-11",
        estado: "emitido",
        subtotal: "10000.00",
        impuestos_total: "0.00",
        total: "10000.00",
        notas: "",
        lineas: [],
        ...data,
      };
      recibos = [creado];
      return HttpResponse.json(creado, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(within(dialog).getByLabelText(/cliente/i), "Cliente Uno");
  await user.selectOptions(within(dialog).getByLabelText(/producto/i), "Pan");
  await user.type(within(dialog).getByLabelText(/cantidad/i), "2");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.click(within(dialog).getByRole("button", { name: "Crear Recibo" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await screen.findByText("R-0001")).toBeInTheDocument();
});

it("quita una línea del carrito antes de confirmar", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(within(dialog).getByLabelText(/producto/i), "Pan");
  await user.type(within(dialog).getByLabelText(/cantidad/i), "2");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.click(within(dialog).getByRole("button", { name: /quitar/i }));

  expect(within(dialog).queryByRole("cell", { name: "Pan" })).not.toBeInTheDocument();
});

it("muestra el error del backend si el servidor rechaza el recibo", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
    http.post(RECEIPTS_URL, () =>
      HttpResponse.json(
        { error: "business_error", message: "No hay existencias suficientes de Pan" },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(within(dialog).getByLabelText(/producto/i), "Pan");
  await user.type(within(dialog).getByLabelText(/cantidad/i), "20");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.click(within(dialog).getByRole("button", { name: "Crear Recibo" }));

  expect(
    await within(dialog).findByText("No hay existencias suficientes de Pan"),
  ).toBeInTheDocument();
  expect(within(dialog).getByRole("cell", { name: "Pan" })).toBeInTheDocument();
});

it("muestra la lista de recibos con su número", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([RECIBO])),
  );

  renderPage();

  expect(await screen.findByText("R-0001")).toBeInTheDocument();
});

it("muestra el detalle completo de un recibo al hacer clic en Ver", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([RECIBO])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Ver" }));
  const dialog = await screen.findByRole("dialog");

  expect(within(dialog).getByText(/R-0001/)).toBeInTheDocument();
  expect(within(dialog).getByText(/Cliente Uno/)).toBeInTheDocument();
  expect(within(dialog).getByText(/2026-11-11/)).toBeInTheDocument();
  expect(within(dialog).getByRole("cell", { name: "Pan" })).toBeInTheDocument();
  expect(within(dialog).getByRole("cell", { name: "2.0000" })).toBeInTheDocument();
  expect(within(dialog).getByRole("cell", { name: "5000.00" })).toBeInTheDocument();
  expect(within(dialog).getByText("10000.00")).toBeInTheDocument();
});

it("muestra el estado del recibo en el listado y en el detalle", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([RECIBO])),
  );
  const user = userEvent.setup();

  renderPage();
  expect(await screen.findByText("emitido")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ver" }));
  const dialog = await screen.findByRole("dialog");

  expect(within(dialog).getByText(/emitido/)).toBeInTheDocument();
});

it("cancela un recibo desde el detalle tras confirmar", async () => {
  let recibo = { ...RECIBO };
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([recibo])),
    http.post(`${RECEIPTS_URL}/:id/cancel`, () => {
      recibo = { ...recibo, estado: "anulado" };
      return HttpResponse.json(recibo);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Ver" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Cancelar recibo" }));
  const confirmDialog = await screen.findByRole("alertdialog");
  await user.click(within(confirmDialog).getByRole("button", { name: "Cancelar recibo" }));

  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(await screen.findByText("anulado")).toBeInTheDocument();
});

it("no cancela el recibo si cierro el diálogo de confirmación sin confirmar", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([RECIBO])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Ver" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Cancelar recibo" }));
  const confirmDialog = await screen.findByRole("alertdialog");
  await user.click(within(confirmDialog).getByRole("button", { name: "Cancelar" }));

  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByText("emitido")).toBeInTheDocument();
});

it("cierra el detalle del recibo y vuelve al listado", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([RECIBO])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Ver" }));
  await screen.findByRole("dialog");
  await user.click(screen.getByRole("button", { name: /cerrar/i }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("R-0001")).toBeInTheDocument();
});
