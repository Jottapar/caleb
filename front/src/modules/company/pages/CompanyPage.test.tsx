import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { CompanyName } from "../../auth";
import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { CompanyPage } from "./CompanyPage";

const URL = "/api/v1/company";

const EMPRESA = {
  nombre: "Panadería Luna",
  documento_fiscal: "9001234567",
  direccion: "Calle 1 # 2-3",
  telefono: "3001234567",
  email: "contacto@luna.com",
};

function renderPage() {
  renderWithProviders([{ path: "/", element: <CompanyPage /> }]);
}

it("muestra en el formulario los datos actuales de la empresa", async () => {
  server.use(http.get(URL, () => HttpResponse.json(EMPRESA)));

  renderPage();

  expect(await screen.findByLabelText(/nombre/i)).toHaveValue("Panadería Luna");
  expect(screen.getByLabelText(/nit/i)).toHaveValue("9001234567");
  expect(screen.getByLabelText(/dirección/i)).toHaveValue("Calle 1 # 2-3");
  expect(screen.getByLabelText(/teléfono/i)).toHaveValue("3001234567");
  expect(screen.getByLabelText(/correo/i)).toHaveValue("contacto@luna.com");
});

it("guarda los cambios, avisa que se guardaron y el encabezado muestra el nombre nuevo", async () => {
  // El nombre vive en un solo lugar, como en el backend: /company y /auth/me lo leen del mismo sitio.
  let empresa = { ...EMPRESA };
  server.use(
    http.get(URL, () => HttpResponse.json(empresa)),
    http.get("/api/v1/auth/me", () =>
      HttpResponse.json({ user_name: "Johan", company_name: empresa.nombre }),
    ),
    http.patch(URL, async ({ request }) => {
      empresa = { ...empresa, ...((await request.json()) as Partial<typeof EMPRESA>) };
      return HttpResponse.json(empresa);
    }),
  );
  const user = userEvent.setup();

  // CompanyName es el nombre del encabezado de la app (lo pinta el Layout).
  renderWithProviders([
    {
      path: "/",
      element: (
        <>
          <CompanyName />
          <CompanyPage />
        </>
      ),
    },
  ]);
  expect(await screen.findByText("Panadería Luna", { selector: "p" })).toBeInTheDocument();

  const nombre = await screen.findByLabelText(/nombre/i);
  await user.clear(nombre);
  await user.type(nombre, "Panadería Sol");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(await screen.findByText("Panadería Sol", { selector: "p" })).toBeInTheDocument();
});

it.each([
  { campo: /nit/i, valor: "900.123.456-7", error: "El NIT solo puede tener números" },
  { campo: /teléfono/i, valor: "300 123", error: "El teléfono solo puede tener números" },
  {
    campo: /correo/i,
    valor: "sinarroba",
    error: "Escribe un correo válido, por ejemplo nombre@dominio.com",
  },
])("con $valor muestra el error junto al campo y no envía nada", async ({ campo, valor, error }) => {
  let enviado = false;
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.patch(URL, () => {
      enviado = true;
      return HttpResponse.json(EMPRESA);
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const input = await screen.findByLabelText(campo);
  await user.clear(input);
  await user.type(input, valor);
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(error)).toBeInTheDocument();
  expect(screen.getByLabelText(campo)).toBeInvalid();
  expect(enviado).toBe(false);
});

it("muestra el mensaje del backend cuando rechaza el guardado", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.patch(URL, () =>
      HttpResponse.json(
        { error: "business_error", message: "El nombre de la empresa es obligatorio" },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderPage();
  await user.clear(await screen.findByLabelText(/nombre/i));
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("El nombre de la empresa es obligatorio")).toBeInTheDocument();
  expect(screen.queryByText(/datos guardados/i)).not.toBeInTheDocument();
});

it("quita el aviso de guardado cuando se intenta guardar de nuevo", async () => {
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.patch(URL, () => HttpResponse.json(EMPRESA)),
  );
  const user = userEvent.setup();

  renderPage();
  await user.click(await screen.findByRole("button", { name: /guardar/i }));
  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();

  // Ahora un NIT invalido: el formulario no envia, y el aviso viejo no debe quedarse.
  const nit = screen.getByLabelText(/nit/i);
  await user.clear(nit);
  await user.type(nit, "abc");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText("El NIT solo puede tener números")).toBeInTheDocument();
  expect(screen.queryByText(/datos guardados/i)).not.toBeInTheDocument();
});

it("envía los datos sin espacios alrededor y los muestra así", async () => {
  let recibido: Record<string, string> = {};
  server.use(
    http.get(URL, () => HttpResponse.json(EMPRESA)),
    http.patch(URL, async ({ request }) => {
      recibido = (await request.json()) as Record<string, string>;
      return HttpResponse.json({ ...EMPRESA, ...recibido });
    }),
  );
  const user = userEvent.setup();

  renderPage();
  const nit = await screen.findByLabelText(/nit/i);
  await user.clear(nit);
  await user.type(nit, " 9007654321 ");
  await user.click(screen.getByRole("button", { name: /guardar/i }));

  expect(await screen.findByText(/datos guardados/i)).toBeInTheDocument();
  expect(recibido.documento_fiscal).toBe("9007654321");
  expect(screen.getByLabelText(/nit/i)).toHaveValue("9007654321");
});
