import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { LoginPage } from "./LoginPage";

it("entra con credenciales correctas y navega a la pantalla protegida", async () => {
  server.use(
    http.post("/api/v1/auth/login", () => HttpResponse.json({ message: "Sesión iniciada" })),
  );
  const user = userEvent.setup();

  renderWithProviders(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "/", element: <div>Pantalla protegida</div> },
    ],
    { initialEntries: ["/login"] },
  );

  await user.type(screen.getByLabelText(/correo/i), "johan@example.com");
  await user.type(screen.getByLabelText(/contraseña/i), "una-clave-segura");
  await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

  expect(await screen.findByText("Pantalla protegida")).toBeInTheDocument();
});

it("muestra el mensaje genérico y se queda en login cuando las credenciales son incorrectas", async () => {
  server.use(
    http.post("/api/v1/auth/login", () =>
      HttpResponse.json(
        { error: "unauthorized", message: "Correo o contraseña incorrectos" },
        { status: 401 },
      ),
    ),
  );
  const user = userEvent.setup();

  renderWithProviders(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "/", element: <div>Pantalla protegida</div> },
    ],
    { initialEntries: ["/login"] },
  );

  await user.type(screen.getByLabelText(/correo/i), "johan@example.com");
  await user.type(screen.getByLabelText(/contraseña/i), "otra-clave");
  await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

  expect(await screen.findByText("Correo o contraseña incorrectos")).toBeInTheDocument();
  expect(screen.queryByText("Pantalla protegida")).not.toBeInTheDocument();
});
