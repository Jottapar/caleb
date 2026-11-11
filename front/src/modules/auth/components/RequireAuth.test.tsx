import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { RequireAuth } from "./RequireAuth";

it("redirige a /login cuando no hay sesión", async () => {
  server.use(
    http.get("/api/v1/auth/me", () =>
      HttpResponse.json({ error: "unauthorized", message: "Sesión inválida o expirada" }, { status: 401 }),
    ),
  );

  renderWithProviders(
    [
      { path: "/", element: <RequireAuth>{<div>Pantalla protegida</div>}</RequireAuth> },
      { path: "/login", element: <div>Pantalla de login</div> },
    ],
    { initialEntries: ["/"] },
  );

  expect(await screen.findByText("Pantalla de login")).toBeInTheDocument();
});
