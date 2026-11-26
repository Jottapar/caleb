import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { UsersPage } from "./UsersPage";

const URL = "/api/v1/users";

type TestUser = {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  // Lo calcula el backend; las pruebas que no hablan de historial lo dejan sin poner.
  tiene_historial?: boolean;
};

// Una "base" en memoria: el GET devuelve lo que haya y el PATCH aplica los cambios que llegan.
// Devuelve la lista de cuerpos que recibió el PATCH, para revisar qué se mandó (o que no se mandó).
function serveUsers(usuarios: TestUser[]) {
  const patches: unknown[] = [];
  server.use(
    http.get(URL, () => HttpResponse.json(usuarios)),
    http.patch(`${URL}/:id`, async ({ request, params }) => {
      const cambios = (await request.json()) as Partial<TestUser>;
      patches.push(cambios);
      const usuario = usuarios.find((u) => u.id === Number(params.id))!;
      Object.assign(usuario, cambios);
      return HttpResponse.json(usuario);
    }),
    http.delete(`${URL}/:id`, ({ params }) => {
      const posicion = usuarios.findIndex((u) => u.id === Number(params.id));
      usuarios.splice(posicion, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return patches;
}

// Quién tiene la sesión. El panel de editar lo pide (`/auth/me`) para saber si ofrecer
// «Restablecer contraseña»; por defecto es un Admin con un id que no choca con los de las pruebas.
const ME_ADMIN = { id: 99, rol: "admin", user_name: "Johan", company_name: "Luna", logo_version: "" };

function renderPage(me: Partial<typeof ME_ADMIN> = {}) {
  server.use(http.get("/api/v1/auth/me", () => HttpResponse.json({ ...ME_ADMIN, ...me })));
  renderWithProviders([{ path: "/", element: <UsersPage /> }]);
}

it("muestra los usuarios de la API con nombre, correo, rol y estado en español", async () => {
  server.use(
    http.get(URL, () =>
      HttpResponse.json([
        {
          id: 2,
          nombre: "Ana Gómez",
          email: "ana@example.com",
          rol: "admin",
          activo: false,
        },
        {
          id: 1,
          nombre: "María Pérez",
          email: "maria@example.com",
          rol: "contador",
          activo: true,
        },
      ]),
    ),
  );

  renderPage();

  const ana = within(await screen.findByRole("row", { name: /ana gómez/i }));
  expect(ana.getByText("ana@example.com")).toBeInTheDocument();
  expect(ana.getByText("Admin")).toBeInTheDocument();
  expect(ana.getByText("Inactivo")).toBeInTheDocument();

  const maria = within(screen.getByRole("row", { name: /maría pérez/i }));
  expect(maria.getByText("maria@example.com")).toBeInTheDocument();
  expect(maria.getByText("Contador")).toBeInTheDocument();
  expect(maria.getByText("Activo")).toBeInTheDocument();
});

it("al crear un usuario aparece en la lista sin recargar la página", async () => {
  // La "base" de la prueba: el GET devuelve lo que haya y el POST agrega a quien se crea.
  const usuarios = [
    {
      id: 1,
      nombre: "Johan",
      email: "johan@example.com",
      rol: "admin",
      activo: true,
    },
  ];
  server.use(
    http.get(URL, () => HttpResponse.json(usuarios)),
    http.post(URL, async ({ request }) => {
      const datos = (await request.json()) as {
        nombre: string;
        email: string;
        rol: string;
      };
      const nuevo = {
        id: 2,
        nombre: datos.nombre,
        email: datos.email,
        rol: datos.rol,
        activo: true,
      };
      usuarios.push(nuevo);
      return HttpResponse.json(nuevo, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await screen.findByRole("row", { name: /johan/i });
  await user.click(
    screen.getByRole("button", { name: /crear usuario nuevo/i }),
  );
  await user.type(await screen.findByLabelText(/nombre/i), "María Pérez");
  await user.type(screen.getByLabelText(/correo/i), "maria@example.com");
  await user.selectOptions(screen.getByLabelText(/rol/i), "contador");
  await user.type(
    screen.getByLabelText(/contraseña inicial/i),
    "clave-de-maria",
  );
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  const maria = within(
    await screen.findByRole("row", { name: /maría pérez/i }),
  );
  expect(maria.getByText("maria@example.com")).toBeInTheDocument();
  expect(maria.getByText("Contador")).toBeInTheDocument();
});

it("muestra un mensaje de error cuando la lista no carga", async () => {
  server.use(
    http.get(URL, () =>
      HttpResponse.json({ message: "Error interno" }, { status: 500 }),
    ),
  );

  renderPage();

  expect(
    await screen.findByText(/no pudimos cargar los usuarios/i),
  ).toBeInTheDocument();
  // No se pinta una tabla vacía que haría creer que no hay usuarios.
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("muestra un indicador mientras carga la lista", async () => {
  server.use(
    http.get(URL, async () => {
      await delay(200);
      return HttpResponse.json([
        {
          id: 1,
          nombre: "Johan",
          email: "johan@example.com",
          rol: "admin",
          activo: true,
        },
      ]);
    }),
  );

  renderPage();

  expect(
    screen.getByRole("status", { name: /cargando usuarios/i }),
  ).toBeInTheDocument();
  // Cuando llegan los datos, el indicador se va y aparece la tabla.
  expect(
    await screen.findByRole("row", { name: /johan/i }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: /cargando usuarios/i }),
  ).not.toBeInTheDocument();
});

it("al pulsar Editar se abre el panel con los datos actuales y sin campo de contraseña", async () => {
  server.use(
    http.get(URL, () =>
      HttpResponse.json([
        {
          id: 1,
          nombre: "María Pérez",
          email: "maria@example.com",
          rol: "contador",
          activo: true,
        },
      ]),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));

  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });
  expect(within(panel).getByLabelText(/nombre/i)).toHaveValue("María Pérez");
  expect(within(panel).getByLabelText(/correo/i)).toHaveValue(
    "maria@example.com",
  );
  expect(within(panel).getByLabelText(/rol/i)).toHaveValue("contador");
  expect(within(panel).queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
});

it("al guardar los cambios el panel se cierra, avisa y la lista muestra los datos nuevos", async () => {
  serveUsers([
    {
      id: 1,
      nombre: "María Pérez",
      email: "maria@example.com",
      rol: "contador",
      activo: true,
    },
  ]);
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });
  await user.clear(within(panel).getByLabelText(/nombre/i));
  await user.type(within(panel).getByLabelText(/nombre/i), "María Gómez");
  await user.selectOptions(within(panel).getByLabelText(/rol/i), "admin");
  await user.click(within(panel).getByRole("button", { name: /guardar/i }));

  const maria = within(
    await screen.findByRole("row", { name: /maría gómez/i }),
  );
  expect(maria.getByText("Admin")).toBeInTheDocument();
  expect(
    screen.queryByRole("dialog", { name: /editar usuario/i }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/usuario actualizado/i);
});

it("un correo repetido se avisa junto al campo y el panel sigue abierto", async () => {
  serveUsers([
    {
      id: 1,
      nombre: "María Pérez",
      email: "maria@example.com",
      rol: "contador",
      activo: true,
    },
  ]);
  // Este handler va después, así que tiene prioridad: el backend rechaza el correo.
  server.use(
    http.patch(`${URL}/:id`, () =>
      HttpResponse.json(
        { message: "Usuario con email=ana@example.com ya existe" },
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });
  const correo = within(panel).getByLabelText(/correo/i);
  await user.clear(correo);
  await user.type(correo, "ana@example.com");
  await user.click(within(panel).getByRole("button", { name: /guardar/i }));

  expect(await within(panel).findByText(/ya existe/i)).toBeInTheDocument();
  expect(correo).toBeInvalid();
  expect(
    screen.getByRole("dialog", { name: /editar usuario/i }),
  ).toBeInTheDocument();
  // Al cambiar el correo, el error se va sin esperar a guardar de nuevo.
  await user.type(correo, "x");
  expect(within(panel).queryByText(/ya existe/i)).not.toBeInTheDocument();
});

it("no envía nada y avisa junto al campo si se deja un dato vacío", async () => {
  const patches = serveUsers([
    {
      id: 1,
      nombre: "María Pérez",
      email: "maria@example.com",
      rol: "contador",
      activo: true,
    },
  ]);
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });
  await user.clear(within(panel).getByLabelText(/nombre/i));
  await user.click(within(panel).getByRole("button", { name: /guardar/i }));

  expect(
    await within(panel).findByText(/el nombre es obligatorio/i),
  ).toBeInTheDocument();
  expect(patches).toHaveLength(0);
  // El panel sigue abierto para que el Admin corrija.
  expect(
    screen.getByRole("dialog", { name: /editar usuario/i }),
  ).toBeInTheDocument();
});

it("un error del backend (último Admin activo) se muestra en el panel y no lo cierra", async () => {
  serveUsers([
    {
      id: 1,
      nombre: "Johan",
      email: "johan@example.com",
      rol: "admin",
      activo: true,
    },
  ]);
  server.use(
    http.patch(`${URL}/:id`, () =>
      HttpResponse.json(
        { message: "La empresa debe tener al menos un Admin activo" },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /johan/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });
  await user.selectOptions(within(panel).getByLabelText(/rol/i), "usuario");
  await user.click(within(panel).getByRole("button", { name: /guardar/i }));

  expect(
    await within(panel).findByText(
      "La empresa debe tener al menos un Admin activo",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("dialog", { name: /editar usuario/i }),
  ).toBeInTheDocument();
  // La lista no cambió: sigue siendo Admin. Con el panel abierto la lista queda oculta para el
  // árbol de accesibilidad, por eso se busca con `hidden`.
  const fila2 = screen.getByRole("row", { name: /johan/i, hidden: true });
  expect(within(fila2).getByText("Admin")).toBeInTheDocument();
});

it("Desactivar usuario pide confirmación y, al confirmar, la lista lo muestra Inactivo", async () => {
  const patches = serveUsers([
    {
      id: 1,
      nombre: "María Pérez",
      email: "maria@example.com",
      rol: "contador",
      activo: true,
    },
  ]);
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });
  await user.click(
    within(panel).getByRole("button", { name: /desactivar usuario/i }),
  );

  const confirmacion = await screen.findByRole("alertdialog");
  expect(confirmacion).toHaveTextContent(
    "¿Desactivar a María Pérez? Ya no podrá entrar a Caleb.",
  );
  // Todavía no se mandó nada: falta confirmar.
  expect(patches).toHaveLength(0);
  await user.click(
    within(confirmacion).getByRole("button", { name: /^desactivar$/i }),
  );

  await waitFor(() => expect(patches).toEqual([{ activo: false }]));
  const filaMaria = screen.getByRole("row", {
    name: /maría pérez/i,
    hidden: true,
  });
  expect(await within(filaMaria).findByText("Inactivo")).toBeInTheDocument();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  // El panel sigue abierto: lo que se haya cambiado en el formulario queda pendiente.
  expect(
    await screen.findByRole("dialog", { name: /editar usuario/i }),
  ).toBeInTheDocument();
});

it("cancelar la confirmación de desactivar no cambia nada", async () => {
  const patches = serveUsers([
    {
      id: 1,
      nombre: "María Pérez",
      email: "maria@example.com",
      rol: "contador",
      activo: true,
    },
  ]);
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });
  await user.click(
    within(panel).getByRole("button", { name: /desactivar usuario/i }),
  );
  const confirmacion = await screen.findByRole("alertdialog");
  await user.click(
    within(confirmacion).getByRole("button", { name: /cancelar/i }),
  );

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(patches).toHaveLength(0);
  const filaMaria = screen.getByRole("row", {
    name: /maría pérez/i,
    hidden: true,
  });
  expect(within(filaMaria).getByText("Activo")).toBeInTheDocument();
  expect(
    screen.getByRole("dialog", { name: /editar usuario/i }),
  ).toBeInTheDocument();
});

it("en un usuario inactivo el botón dice Activar usuario y lo activa sin confirmación", async () => {
  const patches = serveUsers([
    {
      id: 1,
      nombre: "María Pérez",
      email: "maria@example.com",
      rol: "contador",
      activo: false,
    },
  ]);
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });
  await user.click(
    within(panel).getByRole("button", { name: /^activar usuario$/i }),
  );

  // Activar no pide confirmación: se aplica al pulsarlo.
  await waitFor(() => expect(patches).toEqual([{ activo: true }]));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  const filaMaria = screen.getByRole("row", {
    name: /maría pérez/i,
    hidden: true,
  });
  expect(await within(filaMaria).findByText("Activo")).toBeInTheDocument();
  // El panel sigue abierto y ahora ofrece desactivar.
  expect(
    await within(panel).findByRole("button", { name: /desactivar usuario/i }),
  ).toBeInTheDocument();
});

it("el error de último Admin activo al desactivar se muestra y no cambia el estado", async () => {
  serveUsers([{ id: 1, nombre: "Johan", email: "johan@example.com", rol: "admin", activo: true }]);
  server.use(
    http.patch(`${URL}/:id`, () =>
      HttpResponse.json(
        { message: "La empresa debe tener al menos un Admin activo" },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /johan/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });
  await user.click(within(panel).getByRole("button", { name: /desactivar usuario/i }));
  const confirmacion = await screen.findByRole("alertdialog");
  await user.click(within(confirmacion).getByRole("button", { name: /^desactivar$/i }));

  expect(
    await within(confirmacion).findByText("La empresa debe tener al menos un Admin activo"),
  ).toBeInTheDocument();
  // La confirmación sigue abierta y la lista no cambió: sigue Activo.
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  const filaJohan = screen.getByRole("row", { name: /johan/i, hidden: true });
  expect(within(filaJohan).getByText("Activo")).toBeInTheDocument();
});


it("un usuario inactivo y sin historial ofrece Eliminar en el panel", async () => {
  serveUsers([
    {
      id: 1,
      nombre: "María Pérez",
      email: "maria@example.com",
      rol: "contador",
      activo: false,
      tiene_historial: false,
    },
  ]);
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });

  expect(
    within(panel).getByRole("button", { name: /^eliminar usuario$/i }),
  ).toBeInTheDocument();
});

it.each([
  { caso: "activo", activo: true, tiene_historial: false },
  { caso: "inactivo con historial", activo: false, tiene_historial: true },
])("un usuario $caso no ofrece Eliminar", async ({ activo, tiene_historial }) => {
  serveUsers([
    {
      id: 1,
      nombre: "María Pérez",
      email: "maria@example.com",
      rol: "contador",
      activo,
      tiene_historial,
    },
  ]);
  const user = userEvent.setup();

  renderPage();
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  const panel = await screen.findByRole("dialog", { name: /editar usuario/i });

  expect(
    within(panel).queryByRole("button", { name: /eliminar usuario/i }),
  ).not.toBeInTheDocument();
});

const MARIA_ELIMINABLE = {
  id: 1,
  nombre: "María Pérez",
  email: "maria@example.com",
  rol: "contador",
  activo: false,
  tiene_historial: false,
};

async function abrirPanelDeMaria(user: ReturnType<typeof userEvent.setup>) {
  const fila = await screen.findByRole("row", { name: /maría pérez/i });
  await user.click(within(fila).getByRole("button", { name: /editar/i }));
  return screen.findByRole("dialog", { name: /editar usuario/i });
}

it("Eliminar pide confirmación y, al confirmar, el usuario desaparece de la lista, el panel se cierra y avisa", async () => {
  serveUsers([
    { id: 2, nombre: "Johan", email: "johan@example.com", rol: "admin", activo: true },
    { ...MARIA_ELIMINABLE },
  ]);
  const user = userEvent.setup();

  renderPage();
  const panel = await abrirPanelDeMaria(user);
  await user.click(within(panel).getByRole("button", { name: /^eliminar usuario$/i }));
  const confirmacion = await screen.findByRole("alertdialog");
  expect(confirmacion).toHaveTextContent(/¿eliminar a maría pérez\?/i);
  await user.click(within(confirmacion).getByRole("button", { name: /^eliminar$/i }));

  await waitFor(() =>
    expect(screen.queryByRole("row", { name: /maría pérez/i })).not.toBeInTheDocument(),
  );
  expect(screen.queryByRole("dialog", { name: /editar usuario/i })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/usuario eliminado: maría pérez/i);
});

it("cancelar la confirmación de eliminar no manda nada", async () => {
  let eliminaciones = 0;
  serveUsers([{ ...MARIA_ELIMINABLE }]);
  server.use(
    http.delete(`${URL}/:id`, () => {
      eliminaciones += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const panel = await abrirPanelDeMaria(user);
  await user.click(within(panel).getByRole("button", { name: /^eliminar usuario$/i }));
  const confirmacion = await screen.findByRole("alertdialog");
  await user.click(within(confirmacion).getByRole("button", { name: /cancelar/i }));

  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(eliminaciones).toBe(0);
  expect(screen.getByRole("row", { name: /maría pérez/i, hidden: true })).toBeInTheDocument();
});

it("si el backend rechaza eliminar, el mensaje se muestra en la confirmación y el usuario sigue en la lista", async () => {
  serveUsers([{ ...MARIA_ELIMINABLE }]);
  server.use(
    http.delete(`${URL}/:id`, () =>
      HttpResponse.json(
        { message: "No se puede eliminar a un usuario con historial; solo desactivarlo" },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const panel = await abrirPanelDeMaria(user);
  await user.click(within(panel).getByRole("button", { name: /^eliminar usuario$/i }));
  const confirmacion = await screen.findByRole("alertdialog");
  await user.click(within(confirmacion).getByRole("button", { name: /^eliminar$/i }));

  expect(
    await within(confirmacion).findByText(/no se puede eliminar a un usuario con historial/i),
  ).toBeInTheDocument();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(screen.getByRole("row", { name: /maría pérez/i, hidden: true })).toBeInTheDocument();
});

async function abrirCambiarContrasena(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /cambiar mi contraseña/i }));
  return screen.findByRole("dialog", { name: /cambiar mi contraseña/i });
}

it("«Cambiar mi contraseña» abre un diálogo con actual, nueva y confirmar", async () => {
  serveUsers([{ id: 1, nombre: "Johan", email: "johan@example.com", rol: "admin", activo: true }]);
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirCambiarContrasena(user);

  expect(within(dialogo).getByLabelText(/^contraseña actual/i)).toHaveAttribute("type", "password");
  expect(within(dialogo).getByLabelText(/^contraseña nueva/i)).toHaveAttribute("type", "password");
  expect(within(dialogo).getByLabelText(/^confirmar contraseña nueva/i)).toHaveAttribute(
    "type",
    "password",
  );
});

const ADMIN_UNICO = { id: 1, nombre: "Johan", email: "johan@example.com", rol: "admin", activo: true };

async function llenarContrasenas(
  user: ReturnType<typeof userEvent.setup>,
  dialogo: HTMLElement,
  { actual, nueva, confirmar }: { actual: string; nueva: string; confirmar: string },
) {
  await user.type(within(dialogo).getByLabelText(/^contraseña actual/i), actual);
  await user.type(within(dialogo).getByLabelText(/^contraseña nueva/i), nueva);
  await user.type(within(dialogo).getByLabelText(/^confirmar contraseña nueva/i), confirmar);
}

it("al cambiarla bien se manda solo la actual y la nueva, el diálogo se cierra y avisa", async () => {
  serveUsers([{ ...ADMIN_UNICO }]);
  const recibidos: unknown[] = [];
  server.use(
    http.post(`${URL}/me/password`, async ({ request }) => {
      recibidos.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirCambiarContrasena(user);
  await llenarContrasenas(user, dialogo, {
    actual: "una-clave-segura",
    nueva: "clave-nueva-123",
    confirmar: "clave-nueva-123",
  });
  await user.click(within(dialogo).getByRole("button", { name: /^guardar$/i }));

  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: /cambiar mi contraseña/i })).not.toBeInTheDocument(),
  );
  // La confirmación se compara en la pantalla y no viaja al backend.
  expect(recibidos).toEqual([
    { current_password: "una-clave-segura", new_password: "clave-nueva-123" },
  ]);
  expect(screen.getByRole("status")).toHaveTextContent(/contraseña cambiada/i);
});

function contarEnvios() {
  const envios: unknown[] = [];
  server.use(
    http.post(`${URL}/me/password`, async ({ request }) => {
      envios.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return envios;
}

it("una nueva de menos de 8 caracteres se avisa junto al campo y no envía nada", async () => {
  serveUsers([{ ...ADMIN_UNICO }]);
  const envios = contarEnvios();
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirCambiarContrasena(user);
  await llenarContrasenas(user, dialogo, {
    actual: "una-clave-segura",
    nueva: "1234567",
    confirmar: "1234567",
  });
  await user.click(within(dialogo).getByRole("button", { name: /^guardar$/i }));

  expect(
    await within(dialogo).findByText(/la contraseña debe tener al menos 8 caracteres/i),
  ).toBeInTheDocument();
  expect(envios).toEqual([]);
  expect(screen.getByRole("dialog", { name: /cambiar mi contraseña/i })).toBeInTheDocument();
});

it("una confirmación que no coincide se avisa junto al campo y no envía nada", async () => {
  serveUsers([{ ...ADMIN_UNICO }]);
  const envios = contarEnvios();
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirCambiarContrasena(user);
  await llenarContrasenas(user, dialogo, {
    actual: "una-clave-segura",
    nueva: "clave-nueva-123",
    confirmar: "clave-nueva-124",
  });
  await user.click(within(dialogo).getByRole("button", { name: /^guardar$/i }));

  expect(await within(dialogo).findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
  expect(envios).toEqual([]);
});

it("si el backend rechaza el cambio, el mensaje se muestra y el diálogo sigue abierto", async () => {
  serveUsers([{ ...ADMIN_UNICO }]);
  server.use(
    http.post(`${URL}/me/password`, () =>
      HttpResponse.json({ message: "La contraseña actual no es correcta" }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirCambiarContrasena(user);
  await llenarContrasenas(user, dialogo, {
    actual: "equivocada",
    nueva: "clave-nueva-123",
    confirmar: "clave-nueva-123",
  });
  await user.click(within(dialogo).getByRole("button", { name: /^guardar$/i }));

  expect(
    await within(dialogo).findByText("La contraseña actual no es correcta"),
  ).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: /cambiar mi contraseña/i })).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

const MARIA_ACTIVA = {
  id: 1,
  nombre: "María Pérez",
  email: "maria@example.com",
  rol: "contador",
  activo: true,
};

it("un Admin ve «Restablecer contraseña» en el panel de otro usuario", async () => {
  serveUsers([{ ...MARIA_ACTIVA }]);
  const user = userEvent.setup();

  renderPage();
  const panel = await abrirPanelDeMaria(user);

  expect(
    await within(panel).findByRole("button", { name: /^restablecer contraseña$/i }),
  ).toBeInTheDocument();
});

it("no se ofrece Restablecer contraseña en el panel del propio usuario", async () => {
  // La sesión es la de María (id 1): su propio panel.
  serveUsers([{ ...MARIA_ACTIVA, rol: "admin" }]);
  const user = userEvent.setup();

  renderPage({ id: 1 });
  const panel = await abrirPanelDeMaria(user);
  // Se espera a que haya cargado quién soy: sin eso la ausencia no probaría nada.
  await within(panel).findByRole("button", { name: /desactivar usuario/i });
  await waitFor(() =>
    expect(
      within(panel).queryByRole("button", { name: /restablecer contraseña/i }),
    ).not.toBeInTheDocument(),
  );
});

it("quien no es Admin no ve Restablecer contraseña", async () => {
  serveUsers([{ ...MARIA_ACTIVA }]);
  const user = userEvent.setup();

  renderPage({ rol: "contador" });
  const panel = await abrirPanelDeMaria(user);
  await within(panel).findByRole("button", { name: /desactivar usuario/i });

  expect(
    within(panel).queryByRole("button", { name: /restablecer contraseña/i }),
  ).not.toBeInTheDocument();
});

async function abrirRestablecer(user: ReturnType<typeof userEvent.setup>) {
  const panel = await abrirPanelDeMaria(user);
  await user.click(await within(panel).findByRole("button", { name: /^restablecer contraseña$/i }));
  return screen.findByRole("dialog", { name: /restablecer la contraseña de maría pérez/i });
}

async function llenarNueva(
  user: ReturnType<typeof userEvent.setup>,
  dialogo: HTMLElement,
  { nueva, confirmar }: { nueva: string; confirmar: string },
) {
  await user.type(within(dialogo).getByLabelText(/^contraseña nueva/i), nueva);
  await user.type(within(dialogo).getByLabelText(/^confirmar contraseña nueva/i), confirmar);
}

it("Restablecer contraseña abre un diálogo con el nombre y, al guardar, manda solo la nueva, se cierra y avisa", async () => {
  serveUsers([{ ...MARIA_ACTIVA }]);
  const recibidos: unknown[] = [];
  server.use(
    http.post(`${URL}/1/password`, async ({ request }) => {
      recibidos.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirRestablecer(user);
  await llenarNueva(user, dialogo, { nueva: "clave-nueva-123", confirmar: "clave-nueva-123" });
  await user.click(within(dialogo).getByRole("button", { name: /^restablecer$/i }));

  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: /restablecer la contraseña/i })).not.toBeInTheDocument(),
  );
  // La confirmación se compara en la pantalla y no viaja al backend.
  expect(recibidos).toEqual([{ new_password: "clave-nueva-123" }]);
  expect(screen.getByRole("status")).toHaveTextContent(/contraseña restablecida.*maría pérez/i);
});

it.each([
  {
    caso: "una nueva de menos de 8 caracteres",
    nueva: "1234567",
    confirmar: "1234567",
    mensaje: /la contraseña debe tener al menos 8 caracteres/i,
  },
  {
    caso: "una confirmación distinta",
    nueva: "clave-nueva-123",
    confirmar: "clave-nueva-124",
    mensaje: /las contraseñas no coinciden/i,
  },
])("al restablecer, $caso se avisa junto al campo y no envía nada", async ({ nueva, confirmar, mensaje }) => {
  serveUsers([{ ...MARIA_ACTIVA }]);
  const envios: unknown[] = [];
  server.use(
    http.post(`${URL}/1/password`, async ({ request }) => {
      envios.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirRestablecer(user);
  await llenarNueva(user, dialogo, { nueva, confirmar });
  await user.click(within(dialogo).getByRole("button", { name: /^restablecer$/i }));

  expect(await within(dialogo).findByText(mensaje)).toBeInTheDocument();
  expect(envios).toEqual([]);
});

it("al restablecer, si el backend rechaza el mensaje se muestra y el diálogo sigue abierto", async () => {
  serveUsers([{ ...MARIA_ACTIVA }]);
  server.use(
    http.post(`${URL}/1/password`, () =>
      HttpResponse.json(
        { message: "Solo un Admin puede restablecer la contraseña de otro usuario" },
        { status: 403 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirRestablecer(user);
  await llenarNueva(user, dialogo, { nueva: "clave-nueva-123", confirmar: "clave-nueva-123" });
  await user.click(within(dialogo).getByRole("button", { name: /^restablecer$/i }));

  expect(
    await within(dialogo).findByText("Solo un Admin puede restablecer la contraseña de otro usuario"),
  ).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: /restablecer la contraseña/i })).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("al restablecer, el error del backend se quita apenas el Admin vuelve a escribir", async () => {
  serveUsers([{ ...MARIA_ACTIVA }]);
  server.use(
    http.post(`${URL}/1/password`, () =>
      HttpResponse.json({ message: "Solo un Admin puede restablecer la contraseña de otro usuario" }, { status: 403 }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirRestablecer(user);
  await llenarNueva(user, dialogo, { nueva: "clave-nueva-123", confirmar: "clave-nueva-123" });
  await user.click(within(dialogo).getByRole("button", { name: /^restablecer$/i }));
  await within(dialogo).findByText(/solo un admin puede restablecer/i);
  await user.type(within(dialogo).getByLabelText(/^contraseña nueva/i), "x");

  expect(within(dialogo).queryByText(/solo un admin puede restablecer/i)).not.toBeInTheDocument();
});

it("al cambiar mi contraseña, el error del backend se quita apenas se vuelve a escribir", async () => {
  serveUsers([{ ...ADMIN_UNICO }]);
  server.use(
    http.post(`${URL}/me/password`, () =>
      HttpResponse.json({ message: "La contraseña actual no es correcta" }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  const dialogo = await abrirCambiarContrasena(user);
  await llenarContrasenas(user, dialogo, {
    actual: "equivocada",
    nueva: "clave-nueva-123",
    confirmar: "clave-nueva-123",
  });
  await user.click(within(dialogo).getByRole("button", { name: /^guardar$/i }));
  await within(dialogo).findByText("La contraseña actual no es correcta");
  await user.type(within(dialogo).getByLabelText(/^contraseña actual/i), "x");

  expect(within(dialogo).queryByText("La contraseña actual no es correcta")).not.toBeInTheDocument();
});
