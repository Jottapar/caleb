import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { ItemsPage } from "./ItemsPage";

const ITEMS_URL = "/api/v1/items";
const TAXES_URL = "/api/v1/taxes";
const SERVICES_URL = "/api/v1/services";
const SHEETS_URL = "/api/v1/technical-sheets";

// La pagina tambien pide las fichas tecnicas, y la ventana de crear ficha pide los servicios.
// Por defecto no hay ninguno; un test que los necesite declara su propio handler con
// server.use, que tiene prioridad sobre estos.
beforeEach(() => {
  server.use(
    http.get(SHEETS_URL, () => HttpResponse.json([])),
    http.get(SERVICES_URL, () => HttpResponse.json([])),
  );
});

const SIN_IMPUESTO = {
  id: 1,
  nombre: "Sin impuesto",
  porcentaje: "0.00",
  activo: true,
};

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
  // Costo y precio en COP sin decimales; existencias sin decimal cuando es entero
  expect(screen.getByText(/^2\.000\sCOP$/)).toBeInTheDocument();
  expect(screen.getByText(/^3\.500\sCOP$/)).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "10" })).toBeInTheDocument();
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
  await user.click(
    await screen.findByRole("button", { name: "Crear producto" }),
  );
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByRole("option", { name: "Sin impuesto" });
  await user.type(within(dialog).getByLabelText(/nombre/i), "Harina de trigo");
  await user.click(within(dialog).getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("Harina de trigo")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("envía se_vende y es_insumo según los checks del formulario", async () => {
  let enviado: Record<string, unknown> = {};
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([])),
    http.post(ITEMS_URL, async ({ request }) => {
      enviado = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...HARINA, ...enviado }, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Crear producto" }),
  );
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByRole("option", { name: "Sin impuesto" });
  expect(
    within(dialog).getByRole("checkbox", { name: "Se vende" }),
  ).toBeChecked();
  expect(
    within(dialog).getByRole("checkbox", { name: "Es insumo" }),
  ).not.toBeChecked();
  await user.type(within(dialog).getByLabelText(/nombre/i), "Harina de trigo");
  await user.click(within(dialog).getByText("Se vende"));
  await user.click(within(dialog).getByText("Es insumo"));
  await user.click(within(dialog).getByRole("button", { name: /guardar/i }));

  await waitFor(() =>
    expect(enviado).toMatchObject({ se_vende: false, es_insumo: true }),
  );
});

it("deja la ventana abierta y muestra el error si crear el producto falla", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([])),
    http.post(ITEMS_URL, () =>
      HttpResponse.json(
        {
          error: "business_error",
          message: "El producto debe venderse, ser insumo, o las dos cosas",
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Crear producto" }),
  );
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByRole("option", { name: "Sin impuesto" });
  await user.type(within(dialog).getByLabelText(/nombre/i), "Harina de trigo");
  await user.click(within(dialog).getByText("Se vende"));
  await user.click(within(dialog).getByRole("button", { name: /guardar/i }));

  expect(
    await within(dialog).findByText(
      "El producto debe venderse, ser insumo, o las dos cosas",
    ),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByDisplayValue("Harina de trigo"),
  ).toBeInTheDocument();
});

const HARINA = {
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
};

it("abre el drawer con los datos del producto al hacer click en Editar", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));

  expect(
    await screen.findByRole("heading", { name: /editar producto/i }),
  ).toBeInTheDocument();
  expect(screen.getAllByDisplayValue("Harina de trigo")).toHaveLength(1);
});

it("guarda la edición y la fila de la tabla queda actualizada", async () => {
  let producto = { ...HARINA };
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([producto])),
    http.patch(`${ITEMS_URL}/:id`, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      producto = { ...producto, ...data };
      return HttpResponse.json(producto);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  const nombreInput = await screen.findByDisplayValue("Harina de trigo");
  await user.clear(nombreInput);
  await user.type(nombreInput, "Harina Actualizada");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("Harina Actualizada")).toBeInTheDocument();
});

it("cierra el drawer sin guardar al hacer click en Cerrar", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  await screen.findByRole("heading", { name: /editar producto/i });
  await user.click(screen.getByRole("button", { name: /cerrar/i }));

  expect(
    screen.queryByRole("heading", { name: /editar producto/i }),
  ).not.toBeInTheDocument();
});

it("desactiva un producto con el switch y se ve apagado en la lista", async () => {
  let producto = { ...HARINA };
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([producto])),
    http.patch(`${ITEMS_URL}/:id`, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      producto = { ...producto, ...data };
      return HttpResponse.json(producto);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const switchInput = await screen.findByRole("checkbox");
  expect(switchInput).toBeChecked();
  await user.click(switchInput);

  expect(await screen.findByRole("checkbox")).not.toBeChecked();
});

it("reactiva un producto con el switch y se ve prendido en la lista", async () => {
  let producto = { ...HARINA, activo: false };
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([producto])),
    http.patch(`${ITEMS_URL}/:id`, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      producto = { ...producto, ...data };
      return HttpResponse.json(producto);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const switchInput = await screen.findByRole("checkbox");
  expect(switchInput).not.toBeChecked();
  await user.click(switchInput);

  expect(await screen.findByRole("checkbox")).toBeChecked();
});

it("elimina un producto al confirmar en el diálogo", async () => {
  let items = [HARINA];
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json(items)),
    http.delete(`${ITEMS_URL}/:id`, () => {
      items = [];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /eliminar/i }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: /eliminar/i }));

  expect(
    await screen.findByText(/no tienes productos registrados/i),
  ).toBeInTheDocument();
});

it("muestra el error del backend cuando la eliminación falla", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA])),
    http.delete(`${ITEMS_URL}/:id`, () =>
      HttpResponse.json(
        {
          error: "business_error",
          message:
            "No se puede eliminar un producto que ya tiene movimientos de inventario",
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /eliminar/i }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: /eliminar/i }));

  expect(
    await within(dialog).findByText(
      "No se puede eliminar un producto que ya tiene movimientos de inventario",
    ),
  ).toBeInTheDocument();
});

it("no elimina el producto si cancelo el diálogo", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /eliminar/i }));
  await screen.findByRole("heading", { name: /eliminar harina/i });
  await user.click(screen.getByRole("button", { name: /cancelar/i }));

  expect(
    screen.queryByRole("heading", { name: /eliminar harina/i }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Harina de trigo")).toBeInTheDocument();
});

const AZUCAR = {
  id: 2,
  codigo: "AZU-001",
  nombre: "Azúcar",
  unidad: "und",
  costo: "1000.00",
  precio_venta: "2000.00",
  impuesto_id: 1,
  se_vende: true,
  es_insumo: false,
  activo: true,
  existencias: "0",
};

it("agrega una línea al carrito al elegir un producto y una cantidad", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA, AZUCAR])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Agregar existencias" }),
  );
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(
    within(dialog).getByLabelText(/producto/i),
    "Harina de trigo",
  );
  await user.type(within(dialog).getByLabelText(/cantidad/i), "5");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));

  expect(
    within(dialog).getByRole("cell", { name: "Harina de trigo" }),
  ).toBeInTheDocument();
  expect(within(dialog).getByRole("cell", { name: "5" })).toBeInTheDocument();
});

it("el carrito sigue abierto con sus líneas si cierro y vuelvo a abrir la ventana", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA, AZUCAR])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Agregar existencias" }),
  );
  let dialog = await screen.findByRole("dialog");
  await user.selectOptions(
    within(dialog).getByLabelText(/producto/i),
    "Harina de trigo",
  );
  await user.type(within(dialog).getByLabelText(/cantidad/i), "5");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.click(within(dialog).getByRole("button", { name: /cerrar/i }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Agregar existencias" }));
  dialog = await screen.findByRole("dialog");

  expect(
    within(dialog).getByRole("cell", { name: "Harina de trigo" }),
  ).toBeInTheDocument();
});

it("quita una línea del carrito", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA, AZUCAR])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Agregar existencias" }),
  );
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(
    within(dialog).getByLabelText(/producto/i),
    "Harina de trigo",
  );
  await user.type(within(dialog).getByLabelText(/cantidad/i), "5");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.click(within(dialog).getByRole("button", { name: /quitar/i }));

  expect(
    within(dialog).queryByRole("cell", { name: "Harina de trigo" }),
  ).not.toBeInTheDocument();
});

it("actualiza las existencias de todas las líneas al confirmar", async () => {
  let items = [HARINA, AZUCAR];
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json(items)),
    http.post(`${ITEMS_URL}/stock-movements/bulk`, async ({ request }) => {
      const data = (await request.json()) as {
        lineas: { item_id: number; cantidad: string }[];
      };
      items = items.map((item) => {
        const linea = data.lineas.find((l) => l.item_id === item.id);
        if (!linea) {
          return item;
        }
        return {
          ...item,
          existencias: (
            Number(item.existencias) + Number(linea.cantidad)
          ).toFixed(4),
        };
      });
      return HttpResponse.json(items);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Agregar existencias" }),
  );
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(
    within(dialog).getByLabelText(/producto/i),
    "Harina de trigo",
  );
  await user.type(within(dialog).getByLabelText(/cantidad/i), "5");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.click(
    within(dialog).getByRole("button", { name: "Actualizar existencias" }),
  );

  expect(await screen.findByText("15")).toBeInTheDocument();
});

it("si falla la actualización, el carrito sigue con sus líneas y muestra el error", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA, AZUCAR])),
    http.post(`${ITEMS_URL}/stock-movements/bulk`, () =>
      HttpResponse.json(
        {
          error: "business_error",
          message: "La cantidad a agregar debe ser mayor a cero",
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Agregar existencias" }),
  );
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(
    within(dialog).getByLabelText(/producto/i),
    "Harina de trigo",
  );
  await user.type(within(dialog).getByLabelText(/cantidad/i), "-1");
  await user.click(within(dialog).getByRole("button", { name: "Agregar" }));
  await user.click(
    within(dialog).getByRole("button", { name: "Actualizar existencias" }),
  );

  expect(
    await within(dialog).findByText(
      "La cantidad a agregar debe ser mayor a cero",
    ),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole("cell", { name: "Harina de trigo" }),
  ).toBeInTheDocument();
});

// 23 productos para probar la paginacion: "Producto 01" ... "Producto 23"
const VEINTITRES = Array.from({ length: 23 }, (_, index) => ({
  ...HARINA,
  id: index + 1,
  codigo: `P-${String(index + 1).padStart(4, "0")}`,
  nombre: `Producto ${String(index + 1).padStart(2, "0")}`,
}));

function mockItems(items: unknown[]) {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json(items)),
  );
}

it("muestra solo los primeros 10 productos al cargar", async () => {
  mockItems(VEINTITRES);

  renderPage();

  expect(await screen.findByText("Producto 01")).toBeInTheDocument();
  expect(screen.getByText("Producto 10")).toBeInTheDocument();
  expect(screen.queryByText("Producto 11")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–10 de 23")).toBeInTheDocument();
});

it("pasa a la siguiente página con el botón de página siguiente", async () => {
  mockItems(VEINTITRES);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Producto 01");
  await user.click(screen.getByRole("button", { name: /página siguiente/i }));

  expect(await screen.findByText("Producto 11")).toBeInTheDocument();
  expect(screen.queryByText("Producto 01")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 11–20 de 23")).toBeInTheDocument();
});

it("permite ver 50 por página y solo ofrece 10 y 50", async () => {
  mockItems(VEINTITRES);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Producto 01");
  const selector = screen.getByRole("combobox", {
    name: /productos por página/i,
  });
  expect(
    within(selector)
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["10", "50"]);
  await user.selectOptions(selector, "50");

  expect(screen.getByText("Producto 23")).toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–23 de 23")).toBeInTheDocument();
});

// Para los filtros: los pares son productos que se venden, los impares solo son insumos.
const MEZCLADOS = Array.from({ length: 30 }, (_, index) => {
  const seVende = index % 2 === 0;
  return {
    ...HARINA,
    id: index + 1,
    nombre: seVende ? `Vendible ${index + 1}` : `Insumo ${index + 1}`,
    se_vende: seVende,
    es_insumo: !seVende,
  };
});

it("filtra por uso y pagina sobre los filtrados", async () => {
  mockItems(MEZCLADOS);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Vendible 1");
  await user.selectOptions(
    screen.getByLabelText(/filtrar por uso/i),
    "es_insumo",
  );

  expect(screen.getByText("Insumo 2")).toBeInTheDocument();
  expect(screen.queryByText("Vendible 1")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–10 de 15")).toBeInTheDocument();
});

it("al filtrar vuelve a la primera página", async () => {
  mockItems(MEZCLADOS);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Vendible 1");
  await user.click(screen.getByRole("button", { name: "Página 3" }));
  await user.selectOptions(
    screen.getByLabelText(/filtrar por uso/i),
    "se_vende",
  );

  expect(screen.getByText("Vendible 1")).toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–10 de 15")).toBeInTheDocument();
});

it("un producto que se vende y es insumo sale en los dos filtros", async () => {
  mockItems([
    {
      ...HARINA,
      id: 1,
      nombre: "Solo venta",
      se_vende: true,
      es_insumo: false,
    },
    {
      ...HARINA,
      id: 2,
      nombre: "Solo insumo",
      se_vende: false,
      es_insumo: true,
    },
    { ...HARINA, id: 3, nombre: "Los dos", se_vende: true, es_insumo: true },
  ]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Solo venta");
  await user.selectOptions(
    screen.getByLabelText(/filtrar por uso/i),
    "se_vende",
  );
  expect(screen.getByText("Solo venta")).toBeInTheDocument();
  expect(screen.getByText("Los dos")).toBeInTheDocument();
  expect(screen.queryByText("Solo insumo")).not.toBeInTheDocument();

  await user.selectOptions(
    screen.getByLabelText(/filtrar por uso/i),
    "es_insumo",
  );
  expect(screen.getByText("Solo insumo")).toBeInTheDocument();
  expect(screen.getByText("Los dos")).toBeInTheDocument();
  expect(screen.queryByText("Solo venta")).not.toBeInTheDocument();
});

it("busca por nombre sin importar mayúsculas ni tildes", async () => {
  mockItems([
    { ...HARINA, id: 1, nombre: "Azúcar" },
    { ...HARINA, id: 2, nombre: "Harina" },
  ]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Azúcar");
  await user.type(screen.getByLabelText(/buscar producto/i), "AZUCAR");

  expect(screen.getByText("Azúcar")).toBeInTheDocument();
  expect(screen.queryByText("Harina")).not.toBeInTheDocument();
});

it("avisa cuando ningún producto coincide con el filtro", async () => {
  mockItems([HARINA]);
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Harina de trigo");
  await user.type(screen.getByLabelText(/buscar producto/i), "zzz");

  expect(
    screen.getByText(/ningún producto coincide con el filtro/i),
  ).toBeInTheDocument();
});

it("el drawer de editar muestra código, impuesto y las marcas del producto, y no la cantidad inicial", async () => {
  mockItems([{ ...HARINA, se_vende: false, es_insumo: true }]);
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  const drawer = await screen.findByRole("dialog");

  expect(within(drawer).getByDisplayValue("HAR-001")).toBeInTheDocument();
  expect(
    within(drawer).getByRole("checkbox", { name: "Se vende" }),
  ).not.toBeChecked();
  expect(
    within(drawer).getByRole("checkbox", { name: "Es insumo" }),
  ).toBeChecked();
  expect(
    within(drawer).queryByLabelText(/cantidad inicial/i),
  ).not.toBeInTheDocument();
});

it("al guardar la edición envía código y marcas, y la tabla se actualiza", async () => {
  let producto = { ...HARINA };
  let enviado: Record<string, unknown> = {};
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([producto])),
    http.patch(`${ITEMS_URL}/:id`, async ({ request }) => {
      enviado = (await request.json()) as Record<string, unknown>;
      producto = { ...producto, ...enviado };
      return HttpResponse.json(producto);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  const drawer = await screen.findByRole("dialog");
  const codigo = within(drawer).getByDisplayValue("HAR-001");
  await user.clear(codigo);
  await user.type(codigo, "HAR-002");
  await user.click(within(drawer).getByText("Es insumo"));
  await user.click(within(drawer).getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("HAR-002")).toBeInTheDocument();
  expect(enviado).toMatchObject({
    codigo: "HAR-002",
    se_vende: true,
    es_insumo: true,
  });
});

it("muestra en el drawer el error del backend si el código ya existe", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA])),
    http.patch(`${ITEMS_URL}/:id`, () =>
      HttpResponse.json(
        {
          error: "business_error",
          message: "Ya existe un producto con el codigo AZU-001",
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  const drawer = await screen.findByRole("dialog");
  await user.click(within(drawer).getByRole("button", { name: /guardar/i }));

  expect(
    await within(drawer).findByText(
      "Ya existe un producto con el codigo AZU-001",
    ),
  ).toBeInTheDocument();
  expect(
    within(drawer).getByDisplayValue("Harina de trigo"),
  ).toBeInTheDocument();
});

it("la cantidad al agregar existencias no deja escribir letras ni un segundo punto", async () => {
  mockItems([HARINA]);
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Agregar existencias" }),
  );
  const dialog = await screen.findByRole("dialog");
  const cantidad = within(dialog).getByLabelText(/cantidad/i);
  await user.type(cantidad, "1a2b.5.3");

  expect(cantidad).toHaveValue("12.53");
});

it("costo, precio y cantidad inicial al crear no dejan escribir letras", async () => {
  mockItems([]);
  const user = userEvent.setup();

  renderPage();
  await user.click(
    await screen.findByRole("button", { name: "Crear producto" }),
  );
  const dialog = await screen.findByRole("dialog");
  const costo = within(dialog).getByLabelText(/costo/i);
  const precio = within(dialog).getByLabelText(/precio de venta/i);
  const cantidad = within(dialog).getByLabelText(/cantidad inicial/i);
  await user.type(costo, "2a000");
  await user.type(precio, "3,500");
  await user.type(cantidad, "x5");

  expect(costo).toHaveValue("2000");
  expect(precio).toHaveValue("3500");
  expect(cantidad).toHaveValue("5");
});

// Shampoo es insumo; Gel tambien se vende; Pan solo se vende (no puede ir en una ficha)
const SHAMPOO = {
  ...HARINA,
  id: 10,
  codigo: "P-0010",
  nombre: "Shampoo",
  costo: "1000.00",
  se_vende: false,
  es_insumo: true,
};
const GEL = {
  ...HARINA,
  id: 11,
  codigo: "P-0011",
  nombre: "Gel",
  costo: "500.00",
  se_vende: true,
  es_insumo: true,
};
const PAN = {
  ...HARINA,
  id: 12,
  codigo: "P-0012",
  nombre: "Pan",
  costo: "300.00",
  se_vende: true,
  es_insumo: false,
};

const CORTE_SERVICIO = {
  id: 1,
  codigo: "S-0001",
  nombre: "Corte de pelo",
  costo: "8000.00",
  activo: true,
};

const FICHA = {
  id: 1,
  codigo: "F-0001",
  nombre: "Corte de pelo para hombre",
  precio_venta: "25000.00",
  impuesto_id: 1,
  activo: true,
  costo: "8100.00",
  insumos: [],
  servicios: [],
};

async function openSheetDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: "Crear ficha técnica" }),
  );
  return screen.findByRole("dialog", { name: "Crear ficha técnica" });
}

it("muestra las fichas técnicas en la tabla de productos con su código F, costo y sin existencias", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA])),
    http.get(SHEETS_URL, () => HttpResponse.json([FICHA])),
  );

  renderPage();

  const fila = (await screen.findByText("Corte de pelo para hombre")).closest(
    "tr",
  ) as HTMLElement;
  expect(within(fila).getByText("F-0001")).toBeInTheDocument();
  expect(within(fila).getByText(/^8\.100\sCOP$/)).toBeInTheDocument();
  expect(within(fila).getByText(/^25\.000\sCOP$/)).toBeInTheDocument();
  expect(within(fila).getByText("—")).toBeInTheDocument();
});

it("el filtro Fichas técnicas muestra solo las fichas", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([HARINA])),
    http.get(SHEETS_URL, () => HttpResponse.json([FICHA])),
  );
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Corte de pelo para hombre");
  await user.selectOptions(screen.getByLabelText(/filtrar por uso/i), "fichas");

  expect(screen.getByText("Corte de pelo para hombre")).toBeInTheDocument();
  expect(screen.queryByText("Harina de trigo")).not.toBeInTheDocument();
});

it("la ficha técnica solo ofrece productos marcados como insumo", async () => {
  mockItems([SHAMPOO, GEL, PAN]);
  const user = userEvent.setup();

  renderPage();
  const dialog = await openSheetDialog(user);
  const opciones = within(within(dialog).getByLabelText("Insumo"))
    .getAllByRole("option")
    .map((option) => option.textContent);

  expect(opciones).toEqual(["Shampoo", "Gel"]);
});

it("crea un servicio desde la ficha, entra a ella y se guarda la ficha con insumos y servicios", async () => {
  let servicios: unknown[] = [];
  let fichas: unknown[] = [];
  let servicioEnviado: Record<string, unknown> = {};
  let fichaEnviada: Record<string, unknown> = {};
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([SHAMPOO])),
    http.get(SERVICES_URL, () => HttpResponse.json(servicios)),
    http.get(SHEETS_URL, () => HttpResponse.json(fichas)),
    http.post(SERVICES_URL, async ({ request }) => {
      servicioEnviado = (await request.json()) as Record<string, unknown>;
      servicios = [CORTE_SERVICIO];
      return HttpResponse.json(CORTE_SERVICIO, { status: 201 });
    }),
    http.post(SHEETS_URL, async ({ request }) => {
      fichaEnviada = (await request.json()) as Record<string, unknown>;
      const creada = { ...FICHA, nombre: fichaEnviada.nombre };
      fichas = [creada];
      return HttpResponse.json(creada, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const dialog = await openSheetDialog(user);
  await within(dialog).findByRole("option", { name: "Sin impuesto" });
  await user.type(
    within(dialog).getByLabelText(/^nombre/i),
    "Corte de pelo para hombre",
  );
  await user.type(within(dialog).getByLabelText(/precio de venta/i), "25000");
  await user.type(within(dialog).getByLabelText("Cantidad de insumo"), "2");
  await user.click(
    within(dialog).getByRole("button", { name: "Agregar insumo" }),
  );

  // Sin servicios todavía: la ventana solo deja crear uno y, al crearlo, entra a la ficha
  await user.click(
    within(dialog).getByRole("button", { name: "Agregar servicio" }),
  );
  const serviceDialog = await screen.findByRole("dialog", {
    name: "Agregar servicio",
  });
  await user.type(
    within(serviceDialog).getByLabelText(/nombre del servicio/i),
    "Corte de pelo",
  );
  await user.type(within(serviceDialog).getByLabelText("Costo"), "8000");
  await user.click(
    within(serviceDialog).getByRole("button", { name: "Crear y agregar" }),
  );

  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Agregar servicio" }),
    ).not.toBeInTheDocument(),
  );
  expect(servicioEnviado).toEqual({ nombre: "Corte de pelo", costo: "8000" });
  expect(
    await within(dialog).findByRole("cell", { name: "Corte de pelo" }),
  ).toBeInTheDocument();

  // 2 x 1.000 (insumo) + 1 x 8.000 (servicio)
  expect(
    within(dialog).getByText(/costo de la ficha: 10\.000\sCOP/i),
  ).toBeInTheDocument();

  await user.click(
    within(dialog).getByRole("button", { name: "Crear ficha técnica" }),
  );

  expect(
    await screen.findByText("Corte de pelo para hombre"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fichaEnviada).toEqual({
    nombre: "Corte de pelo para hombre",
    precio_venta: "25000",
    impuesto_id: 1,
    insumos: [{ item_id: 10, cantidad: "2" }],
    servicios: [{ servicio_id: 1, cantidad: "1" }],
  });
});

const FICHA_CON_LINEAS = {
  ...FICHA,
  insumos: [
    {
      item_id: 11,
      codigo: "P-0011",
      nombre: "Gel",
      cantidad: "2.0000",
      costo_unitario: "500.00",
    },
  ],
  servicios: [
    {
      servicio_id: 1,
      codigo: "S-0001",
      nombre: "Corte de pelo",
      cantidad: "1.0000",
      costo_unitario: "8000.00",
    },
  ],
};

it("el drawer de editar una ficha muestra sus datos y sus líneas, sin el código editable", async () => {
  mockItems([GEL]);
  server.use(http.get(SHEETS_URL, () => HttpResponse.json([FICHA_CON_LINEAS])));
  const user = userEvent.setup();

  renderPage();
  const fila = (await screen.findByText("Corte de pelo para hombre")).closest(
    "tr",
  ) as HTMLElement;
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const drawer = await screen.findByRole("dialog", {
    name: /editar ficha técnica F-0001/i,
  });

  expect(
    within(drawer).getByDisplayValue("Corte de pelo para hombre"),
  ).toBeInTheDocument();
  expect(within(drawer).getByDisplayValue("25000.00")).toBeInTheDocument();
  expect(within(drawer).getByRole("cell", { name: "Gel" })).toBeInTheDocument();
  expect(
    within(drawer).getByRole("cell", { name: "Corte de pelo" }),
  ).toBeInTheDocument();
  expect(within(drawer).queryByLabelText(/código/i)).not.toBeInTheDocument();
});

it("al guardar la edición de una ficha envía la ficha completa y la tabla se actualiza", async () => {
  let ficha = { ...FICHA_CON_LINEAS };
  let enviado: Record<string, unknown> = {};
  mockItems([GEL]);
  server.use(
    http.get(SHEETS_URL, () => HttpResponse.json([ficha])),
    http.put(`${SHEETS_URL}/:id`, async ({ request }) => {
      enviado = (await request.json()) as Record<string, unknown>;
      ficha = { ...ficha, nombre: enviado.nombre as string };
      return HttpResponse.json(ficha);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const fila = (await screen.findByText("Corte de pelo para hombre")).closest(
    "tr",
  ) as HTMLElement;
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const drawer = await screen.findByRole("dialog", {
    name: /editar ficha técnica/i,
  });
  const nombre = within(drawer).getByDisplayValue("Corte de pelo para hombre");
  await user.clear(nombre);
  await user.type(nombre, "Corte clásico");
  await user.click(within(drawer).getByRole("button", { name: "Guardar" }));

  expect(await screen.findByText("Corte clásico")).toBeInTheDocument();
  expect(enviado).toEqual({
    nombre: "Corte clásico",
    precio_venta: "25000.00",
    impuesto_id: 1,
    insumos: [{ item_id: 11, cantidad: "2.0000" }],
    servicios: [{ servicio_id: 1, cantidad: "1.0000" }],
  });
});

it("muestra en el drawer de la ficha el error del backend y lo deja abierto", async () => {
  mockItems([GEL]);
  server.use(
    http.get(SHEETS_URL, () => HttpResponse.json([FICHA_CON_LINEAS])),
    http.put(`${SHEETS_URL}/:id`, () =>
      HttpResponse.json(
        { message: "El nombre de la ficha tecnica es obligatorio" },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const fila = (await screen.findByText("Corte de pelo para hombre")).closest(
    "tr",
  ) as HTMLElement;
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const drawer = await screen.findByRole("dialog", {
    name: /editar ficha técnica/i,
  });
  await user.click(within(drawer).getByRole("button", { name: "Guardar" }));

  expect(
    await within(drawer).findByText(
      /nombre de la ficha tecnica es obligatorio/i,
    ),
  ).toBeInTheDocument();
});

it("desactiva una ficha con el switch y se ve apagado en la lista", async () => {
  let ficha = { ...FICHA };
  let enviado: Record<string, unknown> = {};
  mockItems([]);
  server.use(
    http.get(SHEETS_URL, () => HttpResponse.json([ficha])),
    http.patch(`${SHEETS_URL}/:id`, async ({ request }) => {
      enviado = (await request.json()) as Record<string, unknown>;
      ficha = { ...ficha, ...enviado } as typeof FICHA;
      return HttpResponse.json(ficha);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const interruptor = await screen.findByRole("checkbox");
  expect(interruptor).toBeChecked();
  await user.click(interruptor);

  await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
  expect(enviado).toEqual({ activo: false });
});

it("elimina una ficha tras confirmar y desaparece de la tabla", async () => {
  let fichas: unknown[] = [FICHA];
  mockItems([HARINA]);
  server.use(
    http.get(SHEETS_URL, () => HttpResponse.json(fichas)),
    http.delete(`${SHEETS_URL}/:id`, () => {
      fichas = [];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const fila = (await screen.findByText("Corte de pelo para hombre")).closest(
    "tr",
  ) as HTMLElement;
  await user.click(within(fila).getByRole("button", { name: /eliminar/i }));
  const dialog = await screen.findByRole("alertdialog");
  expect(
    within(dialog).getByRole("heading", {
      name: "Eliminar Corte de pelo para hombre",
    }),
  ).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: /eliminar/i }));

  await waitFor(() =>
    expect(
      screen.queryByText("Corte de pelo para hombre"),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByText("Harina de trigo")).toBeInTheDocument();
});

it("cancelar el diálogo de eliminar una ficha no la elimina", async () => {
  mockItems([]);
  server.use(http.get(SHEETS_URL, () => HttpResponse.json([FICHA])));
  const user = userEvent.setup();

  renderPage();
  const fila = (await screen.findByText("Corte de pelo para hombre")).closest(
    "tr",
  ) as HTMLElement;
  await user.click(within(fila).getByRole("button", { name: /eliminar/i }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: /cancelar/i }));

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("Corte de pelo para hombre")).toBeInTheDocument();
});

it("no deja crear la ficha sin insumos ni servicios", async () => {
  mockItems([SHAMPOO]);
  const user = userEvent.setup();

  renderPage();
  const dialog = await openSheetDialog(user);

  expect(
    within(dialog).getByRole("button", { name: "Crear ficha técnica" }),
  ).toBeDisabled();
});

it("avisa cuando no hay productos marcados como insumo", async () => {
  mockItems([PAN]);
  const user = userEvent.setup();

  renderPage();
  const dialog = await openSheetDialog(user);

  expect(
    within(dialog).getByText(/no tienes productos marcados como insumo/i),
  ).toBeInTheDocument();
});

it("deja la ventana de la ficha abierta y muestra el error si crearla falla", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([SHAMPOO])),
    http.get(SERVICES_URL, () => HttpResponse.json([CORTE_SERVICIO])),
    http.post(SHEETS_URL, () =>
      HttpResponse.json(
        {
          error: "business_error",
          message: "El nombre de la ficha tecnica es obligatorio",
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const dialog = await openSheetDialog(user);
  await within(dialog).findByRole("option", { name: "Sin impuesto" });
  await user.type(within(dialog).getByLabelText(/^nombre/i), " ");
  await user.click(
    await within(dialog).findByRole("button", { name: "Agregar servicio" }),
  );
  const serviceDialog = await screen.findByRole("dialog", {
    name: "Agregar servicio",
  });
  await user.click(
    await within(serviceDialog).findByRole("button", { name: "Agregar" }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Crear ficha técnica" }),
  );

  expect(
    await within(dialog).findByText(
      "El nombre de la ficha tecnica es obligatorio",
    ),
  ).toBeInTheDocument();
});

it("deja la ventana del servicio abierta y muestra el error si crearlo falla", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([SHAMPOO])),
    http.post(SERVICES_URL, () =>
      HttpResponse.json(
        {
          error: "business_error",
          message: "El nombre del servicio es obligatorio",
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const dialog = await openSheetDialog(user);
  await user.click(
    within(dialog).getByRole("button", { name: "Agregar servicio" }),
  );
  const serviceDialog = await screen.findByRole("dialog", {
    name: "Agregar servicio",
  });
  await user.type(
    within(serviceDialog).getByLabelText(/nombre del servicio/i),
    "x",
  );
  await user.click(
    within(serviceDialog).getByRole("button", { name: "Crear y agregar" }),
  );

  expect(
    await within(serviceDialog).findByText(
      "El nombre del servicio es obligatorio",
    ),
  ).toBeInTheDocument();
});

it("la ventana de agregar servicio ofrece los existentes activos y los agrega con su cantidad", async () => {
  const INACTIVO = {
    ...CORTE_SERVICIO,
    id: 2,
    nombre: "Lavado viejo",
    activo: false,
  };
  let fichaEnviada: Record<string, unknown> = {};
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([SHAMPOO])),
    http.get(SERVICES_URL, () => HttpResponse.json([CORTE_SERVICIO, INACTIVO])),
    http.post(SHEETS_URL, async ({ request }) => {
      fichaEnviada = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        { ...FICHA, nombre: fichaEnviada.nombre },
        { status: 201 },
      );
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const dialog = await openSheetDialog(user);
  await within(dialog).findByRole("option", { name: "Sin impuesto" });
  await user.type(within(dialog).getByLabelText(/^nombre/i), "Corte");
  await user.click(
    within(dialog).getByRole("button", { name: "Agregar servicio" }),
  );
  const serviceDialog = await screen.findByRole("dialog", {
    name: "Agregar servicio",
  });

  // Solo el servicio activo se ofrece
  const opciones = within(
    await within(serviceDialog).findByLabelText("Servicio"),
  )
    .getAllByRole("option")
    .map((option) => option.textContent);
  expect(opciones).toEqual(["Corte de pelo"]);

  const cantidad = within(serviceDialog).getByLabelText("Cantidad");
  await user.clear(cantidad);
  await user.type(cantidad, "2");
  await user.click(
    within(serviceDialog).getByRole("button", { name: "Agregar" }),
  );

  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Agregar servicio" }),
    ).not.toBeInTheDocument(),
  );
  // 2 x 8.000
  expect(
    within(dialog).getByText(/costo de la ficha: 16\.000\sCOP/i),
  ).toBeInTheDocument();
  await user.click(
    within(dialog).getByRole("button", { name: "Crear ficha técnica" }),
  );

  await waitFor(() =>
    expect(fichaEnviada).toMatchObject({
      servicios: [{ servicio_id: 1, cantidad: "2" }],
    }),
  );
});

it("agregar de nuevo un servicio que ya está en la ficha reemplaza su cantidad", async () => {
  server.use(
    http.get(TAXES_URL, () => HttpResponse.json([SIN_IMPUESTO])),
    http.get(ITEMS_URL, () => HttpResponse.json([SHAMPOO])),
    http.get(SERVICES_URL, () => HttpResponse.json([CORTE_SERVICIO])),
  );
  const user = userEvent.setup();

  renderPage();
  const dialog = await openSheetDialog(user);
  for (const cantidadTexto of ["1", "3"]) {
    await user.click(
      await within(dialog).findByRole("button", { name: "Agregar servicio" }),
    );
    const serviceDialog = await screen.findByRole("dialog", {
      name: "Agregar servicio",
    });
    const cantidad = within(serviceDialog).getByLabelText("Cantidad");
    await user.clear(cantidad);
    await user.type(cantidad, cantidadTexto);
    await user.click(
      await within(serviceDialog).findByRole("button", { name: "Agregar" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Agregar servicio" }),
      ).not.toBeInTheDocument(),
    );
  }

  // Una sola fila de servicio, con 3 x 8.000
  expect(
    within(dialog).getAllByRole("cell", { name: "Corte de pelo" }),
  ).toHaveLength(1);
  expect(
    within(dialog).getByText(/costo de la ficha: 24\.000\sCOP/i),
  ).toBeInTheDocument();
});
