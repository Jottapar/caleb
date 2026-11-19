import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { ReceiptsPage } from "./ReceiptsPage";

const RECEIPTS_URL = "/api/v1/receipts";
const THIRD_PARTIES_URL = "/api/v1/third-parties";
const ITEMS_URL = "/api/v1/items";
const BANKS_URL = "/api/v1/banks";
const SHEETS_URL = "/api/v1/technical-sheets";

// La pantalla también pide las fichas técnicas. Por defecto no hay ninguna; un test que las
// necesite declara su propio handler con server.use, que tiene prioridad sobre este.
beforeEach(() => {
  server.use(http.get(SHEETS_URL, () => HttpResponse.json([])));
});

const FICHA = {
  id: 1,
  codigo: "F-0001",
  nombre: "Corte completo",
  precio_venta: "25000.00",
  impuesto_id: 1,
  activo: true,
  costo: "9000.00",
  insumos: [],
  servicios: [],
};

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
  lineas_fichas: [],
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

it("el desplegable ofrece los productos activos que se venden y las fichas activas", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () =>
      HttpResponse.json([
        PRODUCTO,
        { ...PRODUCTO, id: 2, nombre: "Gel", se_vende: false, es_insumo: true },
        { ...PRODUCTO, id: 3, nombre: "Pan viejo", activo: false },
      ]),
    ),
    http.get(SHEETS_URL, () =>
      HttpResponse.json([
        FICHA,
        { ...FICHA, id: 2, nombre: "Ficha apagada", activo: false },
      ]),
    ),
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
    http.get(BANKS_URL, () => HttpResponse.json([])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");
  const opciones = within(await within(dialog).findByLabelText("Producto"))
    .getAllByRole("option")
    .map((option) => option.textContent);

  // Sin el insumo que no se vende, sin el producto inactivo y sin la ficha inactiva
  expect(opciones).toEqual(["Pan", "Corte completo (ficha F-0001)"]);
});

it("vende una ficha: la agrega al carrito y envía lineas_fichas", async () => {
  let body: Record<string, unknown> = {};
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(SHEETS_URL, () => HttpResponse.json([FICHA])),
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
    http.get(BANKS_URL, () => HttpResponse.json([])),
    http.post(RECEIPTS_URL, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(RECIBO, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(
    within(dialog).getByLabelText("Cliente"),
    "Cliente Uno",
  );
  await user.selectOptions(
    await within(dialog).findByLabelText("Producto"),
    "Corte completo (ficha F-0001)",
  );
  await user.type(within(dialog).getByLabelText("Cantidad"), "3");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  expect(
    within(dialog).getByRole("cell", { name: "Corte completo" }),
  ).toBeInTheDocument();
  await user.selectOptions(
    within(dialog).getByLabelText(/condición/i),
    "contado",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Crear Recibo" }),
  );

  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(body.lineas).toEqual([]);
  expect(body.lineas_fichas).toEqual([{ ficha_tecnica_id: 1, cantidad: "3" }]);
});

it("un producto y una ficha con el mismo id no se confunden en el carrito", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])), // id 1
    http.get(SHEETS_URL, () => HttpResponse.json([FICHA])), // id 1
    http.get(RECEIPTS_URL, () => HttpResponse.json([])),
    http.get(BANKS_URL, () => HttpResponse.json([])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByLabelText("Producto");
  await user.type(within(dialog).getByLabelText("Cantidad"), "1");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.selectOptions(
    within(dialog).getByLabelText("Producto"),
    "Corte completo (ficha F-0001)",
  );
  await user.type(within(dialog).getByLabelText("Cantidad"), "1");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));

  // Las dos líneas conviven: agregar la ficha no reemplazó al producto
  expect(within(dialog).getByRole("cell", { name: "Pan" })).toBeInTheDocument();
  expect(
    within(dialog).getByRole("cell", { name: "Corte completo" }),
  ).toBeInTheDocument();
});

it("debajo del botón dice qué falta para crear el recibo", async () => {
  mockBase();
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Crear Recibo" }));
  const dialog = await screen.findByRole("dialog");

  expect(
    within(dialog).getByText(
      "Falta: elegir un cliente, elegir la condición, agregar al menos un producto o ficha técnica.",
    ),
  ).toBeInTheDocument();

  await user.selectOptions(
    within(dialog).getByLabelText(/cliente/i),
    "Cliente Uno",
  );
  await user.selectOptions(
    within(dialog).getByLabelText(/condición/i),
    "credito",
  );
  expect(
    within(dialog).getByText(
      "Falta: indicar la fecha de vencimiento, agregar al menos un producto o ficha técnica.",
    ),
  ).toBeInTheDocument();

  await user.type(within(dialog).getByLabelText(/vencimiento/i), "2026-12-01");
  await user.type(within(dialog).getByLabelText("Cantidad"), "2");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  // Ya no falta nada: el texto desaparece
  expect(within(dialog).queryByText(/^Falta:/)).not.toBeInTheDocument();
});

it("el detalle del recibo muestra también las fichas vendidas", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(RECEIPTS_URL, () =>
      HttpResponse.json([
        {
          ...RECIBO,
          lineas: [],
          lineas_fichas: [
            {
              id: 1,
              ficha_tecnica_id: 1,
              descripcion: "Corte completo",
              cantidad: "3.0000",
              precio_unitario: "25000.00",
              impuesto_porcentaje: "0.00",
              total_linea: "75000.00",
            },
          ],
        },
      ]),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /ver/i }));
  const dialog = await screen.findByRole("dialog");

  expect(
    within(dialog).getByText("Corte completo (ficha)"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("75000.00")).toBeInTheDocument();
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

it("la lista muestra la condición (Contado o Crédito) y si el recibo está Activo o Cancelado", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () =>
      HttpResponse.json([
        RECIBO, // contado, emitido
        { ...RECIBO, id: 2, numero: "R-0002", condicion: "credito" },
        { ...RECIBO, id: 3, numero: "R-0003", estado: "anulado" },
      ]),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  expect(
    await screen.findByRole("columnheader", { name: "Condición" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Estado" })).toBeInTheDocument();
  expect(screen.getAllByRole("cell", { name: "Contado" })).toHaveLength(2);
  expect(screen.getByRole("cell", { name: "Crédito" })).toBeInTheDocument();

  // Cada fila dice si está activa o cancelada
  const fila = (numero: string) =>
    screen.getByText(numero).closest("tr") as HTMLElement;
  expect(within(fila("R-0001")).getByText("Activo")).toBeInTheDocument();
  expect(within(fila("R-0002")).getByText("Activo")).toBeInTheDocument();
  expect(within(fila("R-0003")).getByText("Cancelado")).toBeInTheDocument();
  // Los valores internos del backend no se muestran
  expect(screen.queryByText("emitido")).not.toBeInTheDocument();
  expect(screen.queryByText("anulado")).not.toBeInTheDocument();

  await user.click(within(fila("R-0001")).getByRole("button", { name: "Ver" }));
  expect(
    within(await screen.findByRole("dialog")).getByText(/Estado: Activo/),
  ).toBeInTheDocument();
});

it("cancela un recibo a crédito desde el detalle tras confirmar", async () => {
  let recibo = { ...RECIBO, condicion: "credito", saldo: "10000.00" };
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

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  await user.click(screen.getByRole("button", { name: "Ver" }));
  expect(
    within(await screen.findByRole("dialog")).getByText(/Estado: Cancelado/),
  ).toBeInTheDocument();
});

it("un recibo anulado no ofrece cancelar de nuevo", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ITEMS_URL, () => HttpResponse.json([PRODUCTO])),
    http.get(RECEIPTS_URL, () =>
      HttpResponse.json([{ ...RECIBO, estado: "anulado", condicion: "credito" }]),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Ver" }));
  const dialog = await screen.findByRole("dialog");

  expect(
    within(dialog).queryByRole("button", { name: "Cancelar recibo" }),
  ).not.toBeInTheDocument();
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

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  // El estado ya no está en la lista: se ve en el detalle
  await user.click(await screen.findByRole("button", { name: "Ver" }));
  expect(
    within(await screen.findByRole("dialog")).getByText(/Estado: Cancelado/),
  ).toBeInTheDocument();
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
  // Sigue activo: el botón de cancelar del detalle todavía está
  await user.click(screen.getByRole("button", { name: "Ver" }));
  expect(
    within(await screen.findByRole("dialog")).getByText(/Estado: Activo/),
  ).toBeInTheDocument();
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

// ---------- Paginación y filtros de la lista ----------
const CLIENTE_DOS = { ...CLIENTE, id: 2, nombre: "Cliente Dos" };

function recibo(id: number, terceroId = 1, fecha = "2026-11-11") {
  return {
    ...RECIBO,
    id,
    tercero_id: terceroId,
    numero: `R-${String(id).padStart(4, "0")}`,
    fecha,
    fecha_vencimiento: fecha,
  };
}

function mockLista(recibos: unknown[]) {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE, CLIENTE_DOS])),
    http.get(RECEIPTS_URL, () => HttpResponse.json(recibos)),
  );
}

// 23 recibos: R-0001 ... R-0023. Los pares son del Cliente Dos (11 en total).
const VEINTITRES_RECIBOS = Array.from({ length: 23 }, (_, index) =>
  recibo(index + 1, (index + 1) % 2 === 0 ? 2 : 1),
);

it("la lista de recibos va paginada de 10 en 10, con el más reciente primero", async () => {
  mockLista(VEINTITRES_RECIBOS);
  const user = userEvent.setup();

  renderPage();

  // Misma fecha: el último creado va primero. La primera página trae R-0023 ... R-0014
  expect(await screen.findByText("R-0023")).toBeInTheDocument();
  expect(screen.getByText("R-0014")).toBeInTheDocument();
  expect(screen.queryByText("R-0013")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–10 de 23")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /página siguiente/i }));

  expect(await screen.findByText("R-0013")).toBeInTheDocument();
  expect(screen.queryByText("R-0023")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 11–20 de 23")).toBeInTheDocument();
});

it("permite ver 50 recibos por página y solo ofrece 10 y 50", async () => {
  mockLista(VEINTITRES_RECIBOS);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0023");
  const selector = screen.getByRole("combobox", { name: /recibos por página/i });
  expect(
    within(selector)
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["10", "50"]);
  await user.selectOptions(selector, "50");

  expect(screen.getByText("R-0001")).toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–23 de 23")).toBeInTheDocument();
});

it("ordena por fecha de emisión, el más reciente primero, aunque se haya creado antes", async () => {
  mockLista([
    recibo(1, 1, "2026-11-10"), // creado primero pero emitido más tarde
    recibo(2, 1, "2026-11-01"),
    recibo(3, 1, "2026-11-05"),
  ]);

  renderPage();
  await screen.findByText("R-0001");

  const numeros = screen
    .getAllByRole("row")
    .slice(1) // sin el encabezado
    .map((fila) => within(fila).getAllByRole("cell")[0].textContent);
  expect(numeros).toEqual(["R-0001", "R-0003", "R-0002"]);
});

it("filtra los recibos por cliente", async () => {
  mockLista([recibo(1, 1), recibo(2, 2), recibo(3, 1)]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0002");
  await user.selectOptions(screen.getByLabelText("Filtrar por cliente"), "Cliente Dos");

  expect(screen.getByText("R-0002")).toBeInTheDocument();
  expect(screen.queryByText("R-0001")).not.toBeInTheDocument();
  expect(screen.queryByText("R-0003")).not.toBeInTheDocument();
});

it("filtra por fecha de emisión con desde y hasta inclusivos", async () => {
  mockLista([
    recibo(1, 1, "2026-11-01"),
    recibo(2, 1, "2026-11-05"),
    recibo(3, 1, "2026-11-10"),
    recibo(4, 1, "2026-11-15"),
  ]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0001");
  await user.type(screen.getByLabelText("Emitido desde"), "2026-11-05");
  await user.type(screen.getByLabelText("Emitido hasta"), "2026-11-10");

  // Los extremos (05 y 10) entran; el 01 y el 15 no
  expect(screen.getByText("R-0002")).toBeInTheDocument();
  expect(screen.getByText("R-0003")).toBeInTheDocument();
  expect(screen.queryByText("R-0001")).not.toBeInTheDocument();
  expect(screen.queryByText("R-0004")).not.toBeInTheDocument();
});

it("combina el filtro de cliente con el de fecha", async () => {
  mockLista([
    recibo(1, 1, "2026-11-01"),
    recibo(2, 2, "2026-11-01"),
    recibo(3, 2, "2026-11-20"),
  ]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0001");
  await user.selectOptions(screen.getByLabelText("Filtrar por cliente"), "Cliente Dos");
  await user.type(screen.getByLabelText("Emitido desde"), "2026-11-10");

  expect(screen.getByText("R-0003")).toBeInTheDocument();
  expect(screen.queryByText("R-0002")).not.toBeInTheDocument();
  expect(screen.queryByText("R-0001")).not.toBeInTheDocument();
});

it("al filtrar vuelve a la primera página y pagina sobre el resultado filtrado", async () => {
  mockLista(VEINTITRES_RECIBOS);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0023");
  await user.click(screen.getByRole("button", { name: /página siguiente/i }));
  await screen.findByText("Mostrando 11–20 de 23");
  await user.selectOptions(screen.getByLabelText("Filtrar por cliente"), "Cliente Dos");

  // Son 11 recibos del Cliente Dos: de nuevo la página 1, con 10 de esos 11
  expect(await screen.findByText("Mostrando 1–10 de 11")).toBeInTheDocument();
  expect(screen.getByText("R-0022")).toBeInTheDocument();
});

it("avisa cuando ningún recibo coincide y Limpiar filtros los restablece", async () => {
  mockLista([recibo(1, 1, "2026-11-01")]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0001");
  await user.type(screen.getByLabelText("Emitido desde"), "2026-12-01");

  expect(screen.getByText("Ningún recibo coincide con el filtro.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

  expect(screen.getByText("R-0001")).toBeInTheDocument();
  expect(screen.getByLabelText("Emitido desde")).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
});

// ---------- Filtros por condición y por estado ----------
function reciboCon(
  id: number,
  terceroId: number,
  condicion: "contado" | "credito",
  estado: "emitido" | "anulado" = "emitido",
) {
  return { ...recibo(id, terceroId), condicion, estado };
}

it("filtra por condición: solo contado o solo crédito", async () => {
  mockLista([
    reciboCon(1, 1, "contado"),
    reciboCon(2, 1, "credito"),
    reciboCon(3, 2, "credito"),
  ]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0001");
  await user.selectOptions(
    screen.getByLabelText("Filtrar por condición"),
    "Crédito",
  );

  expect(screen.getByText("R-0002")).toBeInTheDocument();
  expect(screen.getByText("R-0003")).toBeInTheDocument();
  expect(screen.queryByText("R-0001")).not.toBeInTheDocument();
});

it("filtra por estado: solo activos o solo cancelados", async () => {
  mockLista([
    reciboCon(1, 1, "contado"),
    reciboCon(2, 1, "contado", "anulado"),
    reciboCon(3, 1, "credito", "anulado"),
  ]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0001");
  await user.selectOptions(
    screen.getByLabelText("Filtrar por estado"),
    "Cancelados",
  );

  expect(screen.getByText("R-0002")).toBeInTheDocument();
  expect(screen.getByText("R-0003")).toBeInTheDocument();
  expect(screen.queryByText("R-0001")).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText("Filtrar por estado"), "Activos");
  expect(screen.getByText("R-0001")).toBeInTheDocument();
  expect(screen.queryByText("R-0002")).not.toBeInTheDocument();
});

it("busca los recibos de un cliente y los filtra también por condición", async () => {
  mockLista([
    reciboCon(1, 1, "contado"),
    reciboCon(2, 1, "credito"),
    reciboCon(3, 2, "credito"),
    reciboCon(4, 1, "credito", "anulado"),
  ]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0001");
  await user.selectOptions(screen.getByLabelText("Filtrar por cliente"), "Cliente Uno");
  // Todos los recibos del cliente, de cualquier condición
  expect(screen.getByText("R-0001")).toBeInTheDocument();
  expect(screen.getByText("R-0002")).toBeInTheDocument();
  expect(screen.getByText("R-0004")).toBeInTheDocument();
  expect(screen.queryByText("R-0003")).not.toBeInTheDocument();

  // Y ahora solo los de crédito de ese cliente
  await user.selectOptions(screen.getByLabelText("Filtrar por condición"), "Crédito");
  expect(screen.getByText("R-0002")).toBeInTheDocument();
  expect(screen.getByText("R-0004")).toBeInTheDocument();
  expect(screen.queryByText("R-0001")).not.toBeInTheDocument();

  // Y de esos, solo los activos
  await user.selectOptions(screen.getByLabelText("Filtrar por estado"), "Activos");
  expect(screen.getByText("R-0002")).toBeInTheDocument();
  expect(screen.queryByText("R-0004")).not.toBeInTheDocument();
});

it("al filtrar por condición o estado vuelve a la primera página", async () => {
  // 23 recibos; los pares son a crédito (11)
  mockLista(
    Array.from({ length: 23 }, (_, index) =>
      reciboCon(index + 1, 1, (index + 1) % 2 === 0 ? "credito" : "contado"),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0023");
  await user.click(screen.getByRole("button", { name: /página siguiente/i }));
  await screen.findByText("Mostrando 11–20 de 23");
  await user.selectOptions(screen.getByLabelText("Filtrar por condición"), "Crédito");

  expect(await screen.findByText("Mostrando 1–10 de 11")).toBeInTheDocument();
});

it("Limpiar filtros también restablece la condición y el estado", async () => {
  mockLista([reciboCon(1, 1, "contado"), reciboCon(2, 1, "credito", "anulado")]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("R-0001");
  await user.selectOptions(screen.getByLabelText("Filtrar por condición"), "Crédito");
  await user.selectOptions(screen.getByLabelText("Filtrar por estado"), "Activos");
  expect(screen.getByText("Ningún recibo coincide con el filtro.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

  expect(screen.getByText("R-0001")).toBeInTheDocument();
  expect(screen.getByText("R-0002")).toBeInTheDocument();
  expect(screen.getByLabelText("Filtrar por condición")).toHaveValue("todas");
  expect(screen.getByLabelText("Filtrar por estado")).toHaveValue("todos");
});
