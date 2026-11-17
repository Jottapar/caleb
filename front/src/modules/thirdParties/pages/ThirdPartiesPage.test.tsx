import { screen, within } from "@testing-library/react";
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

function renderPage() {
  // El formulario siempre pide la lista de bancos para el desplegable.
  server.use(http.get(BANKS_URL, () => HttpResponse.json(BANKS)));
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

  expect(await screen.findByText(/no tienes terceros registrados/i)).toBeInTheDocument();
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

  expect(await screen.findByRole("heading", { name: /editar tercero/i })).toBeInTheDocument();
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
  await screen.findByRole("heading", { name: /editar tercero/i });
  await user.click(screen.getByRole("button", { name: /cerrar/i }));

  expect(screen.queryByRole("heading", { name: /editar tercero/i })).not.toBeInTheDocument();
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

  expect(await screen.findByText(/no tienes terceros registrados/i)).toBeInTheDocument();
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
  await screen.findByRole("heading", { name: /editar tercero/i });

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
  await screen.findByRole("heading", { name: /editar tercero/i });

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
  await user.type(screen.getByLabelText(/correo/i), "carlos@dominio");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(/escribe un correo válido/i)).toBeInTheDocument();
});

it("al crear no envia y avisa si el telefono tiene algo distinto de numeros", async () => {
  server.use(http.get(URL, () => HttpResponse.json([])), failIfPosted());
  const user = userEvent.setup();

  renderPage();
  await user.type(screen.getByLabelText(/teléfono/i), "300 123 4567");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("El teléfono solo puede tener números")).toBeInTheDocument();
});

it("al crear no envia y avisa si el numero de cuenta tiene algo distinto de numeros", async () => {
  server.use(http.get(URL, () => HttpResponse.json([])), failIfPosted());
  const user = userEvent.setup();

  renderPage();
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
  expect(screen.getByRole("heading", { name: /editar tercero/i })).toBeInTheDocument();
});
