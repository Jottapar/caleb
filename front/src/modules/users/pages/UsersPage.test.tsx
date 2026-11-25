import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { UsersPage } from "./UsersPage";

const URL = "/api/v1/users";

function renderPage() {
  renderWithProviders([{ path: "/", element: <UsersPage /> }]);
}

it("muestra los usuarios de la API con nombre, correo, rol y estado en español", async () => {
  server.use(
    http.get(URL, () =>
      HttpResponse.json([
        { id: 2, nombre: "Ana Gómez", email: "ana@example.com", rol: "admin", activo: false },
        { id: 1, nombre: "María Pérez", email: "maria@example.com", rol: "contador", activo: true },
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
    { id: 1, nombre: "Johan", email: "johan@example.com", rol: "admin", activo: true },
  ];
  server.use(
    http.get(URL, () => HttpResponse.json(usuarios)),
    http.post(URL, async ({ request }) => {
      const datos = (await request.json()) as { nombre: string; email: string; rol: string };
      const nuevo = { id: 2, nombre: datos.nombre, email: datos.email, rol: datos.rol, activo: true };
      usuarios.push(nuevo);
      return HttpResponse.json(nuevo, { status: 201 });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  await screen.findByRole("row", { name: /johan/i });
  await user.click(screen.getByRole("button", { name: /crear usuario nuevo/i }));
  await user.type(await screen.findByLabelText(/nombre/i), "María Pérez");
  await user.type(screen.getByLabelText(/correo/i), "maria@example.com");
  await user.selectOptions(screen.getByLabelText(/rol/i), "contador");
  await user.type(screen.getByLabelText(/contraseña inicial/i), "clave-de-maria");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  const maria = within(await screen.findByRole("row", { name: /maría pérez/i }));
  expect(maria.getByText("maria@example.com")).toBeInTheDocument();
  expect(maria.getByText("Contador")).toBeInTheDocument();
});

it("muestra un mensaje de error cuando la lista no carga", async () => {
  server.use(http.get(URL, () => HttpResponse.json({ message: "Error interno" }, { status: 500 })));

  renderPage();

  expect(await screen.findByText(/no pudimos cargar los usuarios/i)).toBeInTheDocument();
  // No se pinta una tabla vacía que haría creer que no hay usuarios.
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("muestra un indicador mientras carga la lista", async () => {
  server.use(
    http.get(URL, async () => {
      await delay(200);
      return HttpResponse.json([
        { id: 1, nombre: "Johan", email: "johan@example.com", rol: "admin", activo: true },
      ]);
    }),
  );

  renderPage();

  expect(screen.getByRole("status", { name: /cargando usuarios/i })).toBeInTheDocument();
  // Cuando llegan los datos, el indicador se va y aparece la tabla.
  expect(await screen.findByRole("row", { name: /johan/i })).toBeInTheDocument();
  expect(screen.queryByRole("status", { name: /cargando usuarios/i })).not.toBeInTheDocument();
});
