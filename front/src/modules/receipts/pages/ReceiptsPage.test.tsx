import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { ReceiptsPage } from "./ReceiptsPage";

const RECEIPTS_URL = "/api/v1/receipts";
const THIRD_PARTIES_URL = "/api/v1/third-parties";
const ITEMS_URL = "/api/v1/items";
const BANKS_URL = "/api/v1/banks";

const CLIENTE = {
  id: 1,
  tipo: "cliente",
  nombre: "Cliente Uno",
  documento: "900123456",
  email: "uno@correo.com",
  telefono: "3001234567",
  direccion: "Calle 1 # 2-3",
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
  saldo: "0.00",
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

  expect(
    await screen.findByText(/no tienes recibos emitidos/i),
  ).toBeInTheDocument();
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
        saldo: "0.00",
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
  await user.selectOptions(
    within(dialog).getByLabelText(/cliente/i),
    "Cliente Uno",
  );
  await user.selectOptions(within(dialog).getByLabelText(/producto/i), "Pan");
  await user.type(within(dialog).getByLabelText(/cantidad/i), "2");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.selectOptions(
    within(dialog).getByLabelText(/condición/i),
    "contado",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Crear Recibo" }),
  );

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await screen.findByText("R-0001")).toBeInTheDocument();
});

it("muestra el campo de vencimiento solo cuando elijo crédito en el desplegable", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");

  expect(
    within(dialog).queryByLabelText(/vencimiento/i),
  ).not.toBeInTheDocument();
  await user.selectOptions(
    within(dialog).getByLabelText(/condición/i),
    "credito",
  );

  expect(within(dialog).getByLabelText(/vencimiento/i)).toBeInTheDocument();
});

it("crea un recibo a crédito con su fecha de vencimiento", async () => {
  let body: Record<string, unknown> = {};
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
    http.post(RECEIPTS_URL, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        { ...RECIBO, condicion: "credito" },
        { status: 201 },
      );
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(
    within(dialog).getByLabelText(/cliente/i),
    "Cliente Uno",
  );
  await user.selectOptions(within(dialog).getByLabelText(/producto/i), "Pan");
  await user.type(within(dialog).getByLabelText(/cantidad/i), "2");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.selectOptions(
    within(dialog).getByLabelText(/condición/i),
    "credito",
  );
  await user.type(within(dialog).getByLabelText(/vencimiento/i), "2026-12-01");
  await user.click(
    within(dialog).getByRole("button", { name: "Crear Recibo" }),
  );

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(body.condicion).toBe("credito");
  expect(body.fecha_vencimiento).toBe("2026-12-01");
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

  expect(
    within(dialog).queryByRole("cell", { name: "Pan" }),
  ).not.toBeInTheDocument();
});

function mockBase(extra: ReturnType<typeof http.get>[] = []) {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
    http.get(BANKS_URL, () => HttpResponse.json([])),
    ...extra,
  );
}

it("el cliente y la condición empiezan vacíos y sin ellos no se puede crear el recibo", async () => {
  mockBase();
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");

  expect(within(dialog).getByLabelText(/cliente/i)).toHaveValue("");
  expect(within(dialog).getByLabelText(/condición/i)).toHaveValue("");
  await user.type(within(dialog).getByLabelText(/cantidad/i), "2");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  const crear = within(dialog).getByRole("button", { name: "Crear Recibo" });
  expect(crear).toBeDisabled();

  // Con cliente pero sin condición, sigue deshabilitado
  await user.selectOptions(
    within(dialog).getByLabelText(/cliente/i),
    "Cliente Uno",
  );
  expect(crear).toBeDisabled();
  await user.selectOptions(
    within(dialog).getByLabelText(/condición/i),
    "contado",
  );
  expect(crear).toBeEnabled();
});

it("al elegir un cliente muestra su documento, correo, teléfono y dirección", async () => {
  mockBase();
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByText(/900123456/)).not.toBeInTheDocument();
  await user.selectOptions(
    within(dialog).getByLabelText(/cliente/i),
    "Cliente Uno",
  );

  expect(within(dialog).getByText(/900123456/)).toBeInTheDocument();
  expect(within(dialog).getByText(/uno@correo\.com/)).toBeInTheDocument();
  expect(within(dialog).getByText(/3001234567/)).toBeInTheDocument();
  expect(within(dialog).getByText(/Calle 1 # 2-3/)).toBeInTheDocument();
});

it("crea un cliente desde el recibo con el mismo formulario y queda elegido", async () => {
  let terceros: unknown[] = [CLIENTE];
  let enviado: Record<string, unknown> = {};
  const NUEVO = {
    id: 2,
    tipo: "cliente",
    nombre: "Cliente Nuevo",
    documento: "800111222",
    email: "nuevo@correo.com",
    telefono: "3109876543",
    direccion: "Carrera 4 # 5-6",
    activo: true,
    cuenta_bancaria: null,
  };
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json(terceros)),
    http.post(THIRD_PARTIES_URL, async ({ request }) => {
      enviado = (await request.json()) as Record<string, unknown>;
      terceros = [CLIENTE, NUEVO];
      return HttpResponse.json(NUEVO, { status: 201 });
    }),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
    http.get(BANKS_URL, () => HttpResponse.json([])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog", { name: "Crear Recibo" });
  await user.click(
    within(dialog).getByRole("button", { name: "Crear cliente" }),
  );
  const clienteDialog = await screen.findByRole("dialog", {
    name: "Crear cliente",
  });

  // Solo cliente o ambos: un proveedor no iría en un recibo
  const tipos = within(within(clienteDialog).getByLabelText("Tipo"))
    .getAllByRole("option")
    .map((option) => option.textContent);
  expect(tipos).toEqual(["Cliente", "Ambos"]);

  await user.type(
    within(clienteDialog).getByLabelText("Nombre"),
    "Cliente Nuevo",
  );
  await user.type(
    within(clienteDialog).getByLabelText("Documento"),
    "800111222",
  );
  await user.type(
    within(clienteDialog).getByLabelText("Correo"),
    "nuevo@correo.com",
  );
  await user.type(
    within(clienteDialog).getByLabelText("Teléfono"),
    "3109876543",
  );
  await user.type(
    within(clienteDialog).getByLabelText("Dirección"),
    "Carrera 4 # 5-6",
  );
  await user.click(
    within(clienteDialog).getByRole("button", { name: "Guardar" }),
  );

  // El cliente creado queda elegido en el recibo y se ven sus datos
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Crear cliente" }),
    ).not.toBeInTheDocument(),
  );
  expect(enviado).toMatchObject({ tipo: "cliente", nombre: "Cliente Nuevo" });
  expect(within(dialog).getByLabelText("Cliente")).toHaveValue("2");
  expect(within(dialog).getByText(/800111222/)).toBeInTheDocument();
});

it("producto y cantidad están en la misma fila, junto al botón Agregar", async () => {
  mockBase();
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");

  // La fila que contiene el botón Agregar contiene también Producto y Cantidad
  const fila = within(dialog).getByRole("button", { name: "Agregar" })
    .parentElement as HTMLElement;
  expect(within(fila).getByLabelText("Producto")).toBeInTheDocument();
  expect(within(fila).getByLabelText("Cantidad")).toBeInTheDocument();
});

it("muestra el error del backend si el servidor rechaza el recibo", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
    http.post(RECEIPTS_URL, () =>
      HttpResponse.json(
        {
          error: "business_error",
          message: "No hay existencias suficientes de Pan",
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(within(dialog).getByLabelText(/producto/i), "Pan");
  await user.selectOptions(
    within(dialog).getByLabelText(/cliente/i),
    "Cliente Uno",
  );
  await user.type(within(dialog).getByLabelText(/cantidad/i), "20");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.selectOptions(
    within(dialog).getByLabelText(/condición/i),
    "contado",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Crear Recibo" }),
  );

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
  expect(
    within(dialog).getByRole("cell", { name: "2.0000" }),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole("cell", { name: "5000.00" }),
  ).toBeInTheDocument();
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
  await user.click(
    within(dialog).getByRole("button", { name: "Cancelar recibo" }),
  );
  const confirmDialog = await screen.findByRole("alertdialog");
  await user.click(
    within(confirmDialog).getByRole("button", { name: "Cancelar recibo" }),
  );

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
  await user.click(
    within(dialog).getByRole("button", { name: "Cancelar recibo" }),
  );
  const confirmDialog = await screen.findByRole("alertdialog");
  await user.click(
    within(confirmDialog).getByRole("button", { name: "Cancelar" }),
  );

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
