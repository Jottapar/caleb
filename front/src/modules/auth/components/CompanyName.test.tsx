import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { CompanyName } from "./CompanyName";

it("muestra el nombre de la empresa cuando hay sesión activa", async () => {
  server.use(
    http.get("/api/v1/auth/me", () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna" }),
    ),
  );

  renderWithProviders([{ path: "/", element: <CompanyName /> }]);

  expect(await screen.findByText("Panadería Luna")).toBeInTheDocument();
});
