import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { ThirdPartiesPage } from "./ThirdPartiesPage";

const URL = "/api/v1/third-parties";
const BANKS_URL = "/api/v1/banks";

const BANKS = [
  { id: 1, nombre: "Bancolombia" },
  { id: 2, nombre: "Davivienda" },
];

// La mayoria de los tests usa la pantalla de Clientes; los de abajo prueban tambien Proveedores.
function renderPage(tipo: "cliente" | "proveedor" = "cliente") {
  // El formulario siempre pide la lista de bancos para el desplegable.
  server.use(http.get(BANKS_URL, () => HttpResponse.json(BANKS)));
  renderWithProviders([{ path: "/", element: <ThirdPartiesPage tipo={tipo} /> }]);
}

// El formulario de crear vive en una ventana: hay que abrirla con el botón.
async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /crear cliente/i }));
  await screen.findByRole("heading", { name: /crear cliente/i });
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
          direccion: "Calle 1 # 2-3",
          activo: true,
          cuenta_bancaria: null,
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

  expect(await screen.findByText(/no tienes clientes registrados/i)).toBeInTheDocument();
});

it("registra un tercero y lo agrega a la lista", async () => {
  let terceros: unknown[] = [];
  server.use(
    http.get(URL, () => HttpResponse.json(terceros)),
    http.post(URL, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      const creado = { id: 1, activo: true, ...data };
      terceros = [creado];
      return HttpResponse.json(creado, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await openCreateDialog(user);
  await user.type(screen.getByLabelText(/nombre/i), "Carlos");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  // La ventana se cierra al guardar y el tercero aparece en la lista.
  expect(await screen.findByText("Carlos")).toBeInTheDocument();
  await vi.waitFor(() =>
    expect(screen.queryByRole("heading", { name: /crear cliente/i })).not.toBeInTheDocument(),
  );
});

it("la ventana de crear se cierra con Cerrar sin guardar nada", async () => {
  server.use(http.get(URL, () => HttpResponse.json([])), failIfPosted());
  const user = userEvent.setup();

  renderPage();
  await openCreateDialog(user);
  await user.click(screen.getByRole("button", { name: /cerrar/i }));

  await vi.waitFor(() =>
    expect(screen.queryByRole("heading", { name: /crear cliente/i })).not.toBeInTheDocument(),
  );
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
  await openCreateDialog(user);
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  // Con error la ventana queda abierta para que el usuario corrija.
  expect(await screen.findByText("El nombre del tercero es obligatorio")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /crear cliente/i })).toBeInTheDocument();
});

const ANA = {
  id: 1,
  tipo: "cliente" as const,
  nombre: "Ana Pérez",
  documento: "123",
  email: "ana@example.com",
  telefono: "3001234567",
  direccion: "Calle 1 # 2-3",
  activo: true,
  cuenta_bancaria: null,
};

it("abre el drawer con los datos del tercero al hacer click en Editar", async () => {
  server.use(http.get(URL, () => HttpResponse.json([ANA])));
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));

  expect(await screen.findByRole("heading", { name: /editar cliente/i })).toBeInTheDocument();
  expect(screen.getAllByDisplayValue("Ana Pérez")).toHaveLength(1);
});

it("guarda la edicion y la fila de la tabla queda actualizada", async () => {
  let terceros = [ANA];
  server.use(
    http.get(URL, () => HttpResponse.json(terceros)),
    http.patch(`${URL}/:id`, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      terceros = [{ ...ANA, ...data }];
      return HttpResponse.json(terceros[0]);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  const nombreInput = await screen.findByDisplayValue("Ana Pérez");
  await user.clear(nombreInput);
  await user.type(nombreInput, "Ana Actualizada");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("Ana Actualizada")).toBeInTheDocument();
});

it("desactiva un tercero con el switch y se ve apagado en la lista", async () => {
  let tercero = { ...ANA };
  server.use(
    http.get(URL, () => HttpResponse.json([tercero])),
    http.patch(`${URL}/:id`, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      tercero = { ...tercero, ...data };
      return HttpResponse.json(tercero);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const switchInput = await screen.findByRole("checkbox");
  expect(switchInput).toBeChecked();
  await user.click(switchInput);

  expect(await screen.findByRole("checkbox")).not.toBeChecked();
});

it("reactiva un tercero con el switch y se ve prendido en la lista", async () => {
  let tercero = { ...ANA, activo: false };
  server.use(
    http.get(URL, () => HttpResponse.json([tercero])),
    http.patch(`${URL}/:id`, async ({ request }) => {
      const data = (await request.json()) as Record<string, unknown>;
      tercero = { ...tercero, ...data };
      return HttpResponse.json(tercero);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const switchInput = await screen.findByRole("checkbox");
  expect(switchInput).not.toBeChecked();
  await user.click(switchInput);

  expect(await screen.findByRole("checkbox")).toBeChecked();
});

it("cierra el drawer sin guardar al hacer click en Cerrar", async () => {
  server.use(http.get(URL, () => HttpResponse.json([ANA])));
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  await screen.findByRole("heading", { name: /editar cliente/i });
  await user.click(screen.getByRole("button", { name: /cerrar/i }));

  expect(screen.queryByRole("heading", { name: /editar cliente/i })).not.toBeInTheDocument();
});

it("elimina un tercero al confirmar en el dialogo", async () => {
  let terceros = [ANA];
  server.use(
    http.get(URL, () => HttpResponse.json(terceros)),
    http.delete(`${URL}/:id`, () => {
      terceros = [];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /eliminar/i }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: /eliminar/i }));

  expect(await screen.findByText(/no tienes clientes registrados/i)).toBeInTheDocument();
});

it("muestra el error del backend cuando la eliminacion falla", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json([ANA])),
    http.delete(`${URL}/:id`, () =>
      HttpResponse.json(
        { error: "not_found", message: "Tercero no encontrado" },
        { status: 404 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /eliminar/i }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: /eliminar/i }));

  expect(await within(dialog).findByText("Tercero no encontrado")).toBeInTheDocument();
});

it("no elimina el tercero si cancelo el dialogo", async () => {
  server.use(http.get(URL, () => HttpResponse.json([ANA])));
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /eliminar/i }));
  await screen.findByRole("heading", { name: /eliminar a ana/i });
  await user.click(screen.getByRole("button", { name: /cancelar/i }));

  expect(screen.queryByRole("heading", { name: /eliminar a ana/i })).not.toBeInTheDocument();
  expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
});

it("envia la cuenta bancaria elegida", async () => {
  let terceros: unknown[] = [];
  let recibido: Record<string, unknown> = {};
  server.use(
    http.get(URL, () => HttpResponse.json(terceros)),
    http.post(URL, async ({ request }) => {
      recibido = (await request.json()) as Record<string, unknown>;
      const creado = {
        id: 1,
        activo: true,
        ...recibido,
        cuenta_bancaria: {
          banco_id: 1,
          banco_nombre: "Bancolombia",
          tipo_cuenta: "corriente",
          numero_cuenta: "0123456789",
        },
      };
      terceros = [creado];
      return HttpResponse.json(creado, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await openCreateDialog(user);
  await user.type(screen.getByLabelText(/nombre/i), "Insumos SAS");
  await user.selectOptions(screen.getByLabelText(/^banco/i), await screen.findByRole("option", { name: "Bancolombia" }));
  await user.selectOptions(screen.getByLabelText(/tipo de cuenta/i), "corriente");
  await user.type(screen.getByLabelText(/número de cuenta/i), "0123456789");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("Insumos SAS")).toBeInTheDocument();
  expect(recibido.cuenta_bancaria).toEqual({
    banco_id: 1,
    tipo_cuenta: "corriente",
    numero_cuenta: "0123456789",
  });
});

it("envia la cuenta bancaria en null si no se elige banco", async () => {
  let recibido: Record<string, unknown> = {};
  server.use(
    http.get(URL, () => HttpResponse.json([])),
    http.post(URL, async ({ request }) => {
      recibido = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: 1, activo: true, ...recibido }, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await openCreateDialog(user);
  await user.type(screen.getByLabelText(/nombre/i), "Carlos");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  await vi.waitFor(() => expect(recibido).toHaveProperty("cuenta_bancaria", null));
  expect(screen.queryByLabelText(/número de cuenta/i)).not.toBeInTheDocument();
});

it("al editar muestra la cuenta bancaria que ya tenia el tercero", async () => {
  const conCuenta = {
    ...ANA,
    cuenta_bancaria: {
      banco_id: 2,
      banco_nombre: "Davivienda",
      tipo_cuenta: "ahorros",
      numero_cuenta: "555",
    },
  };
  server.use(http.get(URL, () => HttpResponse.json([conCuenta])));
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  await screen.findByRole("heading", { name: /editar cliente/i });

  expect(await screen.findByDisplayValue("555")).toBeInTheDocument();
  expect(screen.getAllByDisplayValue("Davivienda")).toHaveLength(1);
});

it("la lista no muestra direccion ni cuenta bancaria", async () => {
  const conCuenta = {
    ...ANA,
    cuenta_bancaria: {
      banco_id: 1,
      banco_nombre: "Bancolombia",
      tipo_cuenta: "ahorros",
      numero_cuenta: "555",
    },
  };
  server.use(http.get(URL, () => HttpResponse.json([conCuenta])));

  renderPage();

  expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: /dirección/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Calle 1 # 2-3")).not.toBeInTheDocument();
  expect(screen.queryByText("555")).not.toBeInTheDocument();
});

it("al editar muestra todos los datos, incluida la direccion", async () => {
  server.use(http.get(URL, () => HttpResponse.json([ANA])));
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  await screen.findByRole("heading", { name: /editar cliente/i });

  expect(screen.getByDisplayValue("Calle 1 # 2-3")).toBeInTheDocument();
  expect(screen.getByDisplayValue("ana@example.com")).toBeInTheDocument();
  expect(screen.getByDisplayValue("3001234567")).toBeInTheDocument();
});

// Si el front deja pasar algo, este handler hace fallar el test: no debe llegar al backend.
function failIfPosted() {
  return http.post(URL, () => {
    throw new Error("El formulario no debia enviarse");
  });
}

it("al crear no envia y avisa si el correo no tiene formato de correo", async () => {
  server.use(http.get(URL, () => HttpResponse.json([])), failIfPosted());
  const user = userEvent.setup();

  renderPage();
  await openCreateDialog(user);
  await user.type(screen.getByLabelText(/correo/i), "carlos@dominio");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(/escribe un correo válido/i)).toBeInTheDocument();
});

it("al crear no envia y avisa si el telefono tiene algo distinto de numeros", async () => {
  server.use(http.get(URL, () => HttpResponse.json([])), failIfPosted());
  const user = userEvent.setup();

  renderPage();
  await openCreateDialog(user);
  await user.type(screen.getByLabelText(/teléfono/i), "300 123 4567");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("El teléfono solo puede tener números")).toBeInTheDocument();
});

it("al crear no envia y avisa si el numero de cuenta tiene algo distinto de numeros", async () => {
  server.use(http.get(URL, () => HttpResponse.json([])), failIfPosted());
  const user = userEvent.setup();

  renderPage();
  await openCreateDialog(user);
  await user.selectOptions(
    screen.getByLabelText(/^banco/i),
    await screen.findByRole("option", { name: "Bancolombia" }),
  );
  await user.type(screen.getByLabelText(/número de cuenta/i), "0123-456");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(
    await screen.findByText("El número de cuenta solo puede tener números"),
  ).toBeInTheDocument();
});

it("el numero de cuenta no deja escribir mas de 20 digitos", async () => {
  server.use(http.get(URL, () => HttpResponse.json([])));
  const user = userEvent.setup();

  renderPage();
  await openCreateDialog(user);
  await user.selectOptions(
    screen.getByLabelText(/^banco/i),
    await screen.findByRole("option", { name: "Bancolombia" }),
  );
  const numero = screen.getByLabelText(/número de cuenta/i);
  await user.type(numero, "1".repeat(25));

  expect(numero).toHaveValue("1".repeat(20));
});

it("al editar en el drawer tambien valida el formato antes de guardar", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json([ANA])),
    http.patch(`${URL}/:id`, () => {
      throw new Error("El formulario no debia enviarse");
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /editar/i }));
  const telefono = await screen.findByDisplayValue("3001234567");
  await user.clear(telefono);
  await user.type(telefono, "300-abc");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("El teléfono solo puede tener números")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /editar cliente/i })).toBeInTheDocument();
});

// 23 terceros: "Tercero 01" ... "Tercero 23". Con 10 por pagina son 3 paginas.
const VEINTITRES = Array.from({ length: 23 }, (_, index) => ({
  ...ANA,
  id: index + 1,
  nombre: `Tercero ${String(index + 1).padStart(2, "0")}`,
}));

it("muestra solo los primeros 10 terceros al cargar", async () => {
  server.use(http.get(URL, () => HttpResponse.json(VEINTITRES)));

  renderPage();

  expect(await screen.findByText("Tercero 01")).toBeInTheDocument();
  expect(screen.getByText("Tercero 10")).toBeInTheDocument();
  expect(screen.queryByText("Tercero 11")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–10 de 23")).toBeInTheDocument();
});

it("pasa a la siguiente pagina con el boton de pagina siguiente", async () => {
  server.use(http.get(URL, () => HttpResponse.json(VEINTITRES)));
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Tercero 01");
  await user.click(screen.getByRole("button", { name: /página siguiente/i }));

  expect(await screen.findByText("Tercero 11")).toBeInTheDocument();
  expect(screen.queryByText("Tercero 01")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 11–20 de 23")).toBeInTheDocument();
});

it("la ultima pagina muestra solo los terceros que quedan", async () => {
  server.use(http.get(URL, () => HttpResponse.json(VEINTITRES)));
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Tercero 01");
  await user.click(screen.getByRole("button", { name: "Página 3" }));

  expect(await screen.findByText("Tercero 21")).toBeInTheDocument();
  expect(screen.getByText("Tercero 23")).toBeInTheDocument();
  expect(screen.getByText("Mostrando 21–23 de 23")).toBeInTheDocument();
});

it("permite ver 50 por pagina y solo ofrece 10 y 50", async () => {
  server.use(http.get(URL, () => HttpResponse.json(VEINTITRES)));
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Tercero 01");
  const selector = screen.getByRole("combobox", { name: /clientes por página/i });
  const opciones = within(selector)
    .getAllByRole("option")
    .map((option) => option.textContent);
  await user.selectOptions(selector, "50");

  expect(opciones).toEqual(["10", "50"]);
  expect(screen.getByText("Tercero 23")).toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–23 de 23")).toBeInTheDocument();
});

it("al cambiar a 50 por pagina vuelve a la primera pagina", async () => {
  server.use(http.get(URL, () => HttpResponse.json(VEINTITRES)));
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Tercero 01");
  await user.click(screen.getByRole("button", { name: "Página 3" }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: /clientes por página/i }),
    "50",
  );

  expect(screen.getByText("Tercero 01")).toBeInTheDocument();
});

it("al eliminar el unico tercero de la ultima pagina muestra la pagina anterior", async () => {
  let terceros = VEINTITRES.slice(0, 21); // la pagina 3 solo tiene "Tercero 21"
  server.use(
    http.get(URL, () => HttpResponse.json(terceros)),
    http.delete(`${URL}/:id`, () => {
      terceros = terceros.slice(0, 20);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Tercero 01");
  await user.click(screen.getByRole("button", { name: "Página 3" }));
  await user.click(await screen.findByRole("button", { name: /^eliminar$/i }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: /eliminar/i }));

  expect(await screen.findByText("Tercero 11")).toBeInTheDocument();
  expect(screen.getByText("Mostrando 11–20 de 20")).toBeInTheDocument();
});

// 60 terceros intercalados: cliente, proveedor, cliente, proveedor...
// Si la pagina cortara antes de quedarse con su tipo, la primera pagina de 10 traeria solo 5.
const INTERCALADOS = Array.from({ length: 60 }, (_, index) => {
  const numero = String(Math.floor(index / 2) + 1).padStart(2, "0");
  const esCliente = index % 2 === 0;
  return {
    ...ANA,
    id: index + 1,
    tipo: esCliente ? ("cliente" as const) : ("proveedor" as const),
    nombre: esCliente ? `Cliente ${numero}` : `Proveedor ${numero}`,
  };
});

it("la pantalla de Clientes muestra solo clientes y pagina sobre ellos", async () => {
  server.use(http.get(URL, () => HttpResponse.json(INTERCALADOS)));

  renderPage("cliente");

  expect(await screen.findByText("Cliente 01")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Clientes" })).toBeInTheDocument();
  expect(screen.getByText("Cliente 10")).toBeInTheDocument();
  expect(screen.queryByText("Proveedor 01")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–10 de 30")).toBeInTheDocument();
});

it("la pantalla de Proveedores muestra solo proveedores, aunque en la lista completa esten mas atras", async () => {
  server.use(http.get(URL, () => HttpResponse.json(INTERCALADOS)));
  const user = userEvent.setup();

  renderPage("proveedor");
  await screen.findByText("Proveedor 01");
  expect(screen.getByRole("heading", { name: "Proveedores" })).toBeInTheDocument();
  await user.selectOptions(screen.getByRole("combobox", { name: /proveedores por página/i }), "50");

  // "Proveedor 30" es el tercero 60 de la lista completa.
  expect(screen.getByText("Proveedor 30")).toBeInTheDocument();
  expect(screen.queryByText("Cliente 01")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–30 de 30")).toBeInTheDocument();
});

it("la pantalla de Clientes dice que no hay clientes aunque haya proveedores", async () => {
  server.use(http.get(URL, () => HttpResponse.json([{ ...ANA, tipo: "proveedor" }])));

  renderPage("cliente");

  expect(await screen.findByText(/no tienes clientes registrados/i)).toBeInTheDocument();
  expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
});

it("crear desde Proveedores no pregunta el tipo y envia proveedor", async () => {
  let enviado: Record<string, unknown> = {};
  server.use(
    http.get(URL, () => HttpResponse.json([])),
    http.post(URL, async ({ request }) => {
      enviado = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: 1, activo: true, ...enviado }, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage("proveedor");
  await user.click(await screen.findByRole("button", { name: /crear proveedor/i }));
  await screen.findByRole("heading", { name: /crear proveedor/i });
  expect(screen.queryByLabelText("Tipo")).not.toBeInTheDocument();
  await user.type(screen.getByLabelText(/nombre/i), "Distribuidora");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  await vi.waitFor(() => expect(enviado).toMatchObject({ tipo: "proveedor", nombre: "Distribuidora" }));
});

it("al buscar vuelve a la primera pagina", async () => {
  server.use(http.get(URL, () => HttpResponse.json(INTERCALADOS)));
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Cliente 01");
  await user.click(screen.getByRole("button", { name: "Página 3" }));
  // "Cliente" coincide con los 30: cambia el filtro pero no el resultado.
  await user.type(screen.getByLabelText(/buscar cliente/i), "Cliente");

  expect(screen.getByText("Cliente 01")).toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–10 de 30")).toBeInTheDocument();
});

it("busca por nombre sin importar mayusculas ni tildes", async () => {
  const terceros = [
    { ...ANA, id: 1, nombre: "Ana Pérez" },
    { ...ANA, id: 2, nombre: "Carlos Gómez" },
  ];
  server.use(http.get(URL, () => HttpResponse.json(terceros)));
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Ana Pérez");
  await user.type(screen.getByLabelText(/buscar cliente/i), "PEREZ");

  expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
  expect(screen.queryByText("Carlos Gómez")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
});

it("en Proveedores la busqueda solo encuentra proveedores", async () => {
  server.use(http.get(URL, () => HttpResponse.json(INTERCALADOS)));
  const user = userEvent.setup();

  renderPage("proveedor");
  await screen.findByText("Proveedor 01");
  await user.type(screen.getByLabelText(/buscar proveedor/i), "2");

  // Proveedores con "2" en el nombre: 02, 12, 20 a 29 → 12 en total.
  expect(screen.getByText("Proveedor 02")).toBeInTheDocument();
  expect(screen.queryByText("Cliente 02")).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 1–10 de 12")).toBeInTheDocument();
});

it("avisa cuando ningun tercero coincide con el filtro", async () => {
  server.use(http.get(URL, () => HttpResponse.json([ANA])));
  const user = userEvent.setup();

  renderPage();
  await screen.findByText("Ana Pérez");
  await user.type(screen.getByLabelText(/buscar cliente/i), "zzz");

  expect(screen.getByText(/ningún cliente coincide con la búsqueda/i)).toBeInTheDocument();
  // El buscador sigue a la vista para poder corregir lo que se escribio.
  expect(screen.getByLabelText(/buscar cliente/i)).toHaveValue("zzz");
});

// ---------- soft eliminados ----------

const DELETED_URL = "/api/v1/third-parties/deleted";

const CLIENTE_SOFT_ELIMINADO = {
  id: 7,
  tipo: "cliente",
  nombre: "Carlos Soto",
  documento: "555",
  email: "carlos@example.com",
  telefono: "3109998888",
  direccion: "Calle 9 # 8-7",
  activo: true,
  cuenta_bancaria: null,
};

const PROVEEDOR_SOFT_ELIMINADO = {
  ...CLIENTE_SOFT_ELIMINADO,
  id: 8,
  tipo: "proveedor",
  nombre: "Luis Proveedor",
};

it("muestra en «Restaurar clientes» solo los clientes soft eliminados", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json([])),
    http.get(DELETED_URL, () =>
      HttpResponse.json([CLIENTE_SOFT_ELIMINADO, PROVEEDOR_SOFT_ELIMINADO]),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Restaurar clientes" }));

  const dialog = await screen.findByRole("dialog", { name: /clientes soft eliminados/i });
  expect(await within(dialog).findByText("Carlos Soto")).toBeInTheDocument();
  expect(within(dialog).getByText("555")).toBeInTheDocument();
  expect(within(dialog).getByText("carlos@example.com")).toBeInTheDocument();
  expect(within(dialog).getByText("3109998888")).toBeInTheDocument();
  expect(within(dialog).queryByText("Luis Proveedor")).not.toBeInTheDocument();
});

it("al restaurar un cliente sale del diálogo y vuelve a aparecer en la lista de Clientes", async () => {
  let restaurado = false;
  server.use(
    http.get(URL, () =>
      HttpResponse.json(restaurado ? [{ ...CLIENTE_SOFT_ELIMINADO }] : []),
    ),
    http.get(DELETED_URL, () =>
      HttpResponse.json(restaurado ? [] : [CLIENTE_SOFT_ELIMINADO]),
    ),
    http.post(`${URL}/7/restore`, () => {
      restaurado = true;
      return HttpResponse.json(CLIENTE_SOFT_ELIMINADO);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Restaurar clientes" }));
  const dialog = await screen.findByRole("dialog", { name: /clientes soft eliminados/i });
  await user.click(await within(dialog).findByRole("button", { name: "Restaurar" }));

  await waitFor(() => expect(within(dialog).queryByText("Carlos Soto")).not.toBeInTheDocument());
  await user.click(within(dialog).getByRole("button", { name: /cerrar/i }));
  expect(await screen.findByText("Carlos Soto")).toBeInTheDocument();
});

it("muestra un mensaje cuando no hay clientes soft eliminados", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json([])),
    // Hay un proveedor soft eliminado, pero ningún cliente: para esta pantalla no hay nada.
    http.get(DELETED_URL, () => HttpResponse.json([PROVEEDOR_SOFT_ELIMINADO])),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Restaurar clientes" }));

  const dialog = await screen.findByRole("dialog", { name: /clientes soft eliminados/i });
  expect(
    await within(dialog).findByText(/no tienes clientes soft eliminados/i),
  ).toBeInTheDocument();
});

it("muestra un error cuando no se puede cargar la lista de clientes soft eliminados", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json([])),
    http.get(DELETED_URL, () => HttpResponse.json({ message: "Error" }, { status: 500 })),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: "Restaurar clientes" }));

  const dialog = await screen.findByRole("dialog", { name: /clientes soft eliminados/i });
  expect(
    await within(dialog).findByText(/no pudimos cargar tus clientes soft eliminados/i),
  ).toBeInTheDocument();
});
