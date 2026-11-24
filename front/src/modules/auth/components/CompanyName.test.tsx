import { fireEvent, screen } from "@testing-library/react";
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

it("muestra el logo junto al nombre cuando la empresa tiene logo", async () => {
  server.use(
    http.get("/api/v1/auth/me", () =>
      HttpResponse.json({
        user_name: "Johan",
        company_name: "Panadería Luna",
        logo_version: "empresas/1/logo-abc.png",
      }),
    ),
  );

  renderWithProviders([{ path: "/", element: <CompanyName /> }]);

  const logo = await screen.findByRole("img", { name: /logo de la empresa/i });
  // La version va en la URL (con "/" codificada) para que un logo nuevo no se vea con el viejo en cache.
  expect(logo).toHaveAttribute("src", "/api/v1/company/logo?v=empresas%2F1%2Flogo-abc.png");
  expect(screen.getByText("Panadería Luna")).toBeInTheDocument();
});

it("muestra solo el nombre cuando la empresa no tiene logo", async () => {
  server.use(
    http.get("/api/v1/auth/me", () =>
      HttpResponse.json({ user_name: "Johan", company_name: "Panadería Luna", logo_version: "" }),
    ),
  );

  renderWithProviders([{ path: "/", element: <CompanyName /> }]);

  expect(await screen.findByText("Panadería Luna")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("si el logo no carga, el encabezado muestra solo el nombre y no una imagen rota", async () => {
  server.use(
    http.get("/api/v1/auth/me", () =>
      HttpResponse.json({
        user_name: "Johan",
        company_name: "Panadería Luna",
        logo_version: "empresas/1/logo-abc.png",
      }),
    ),
  );

  renderWithProviders([{ path: "/", element: <CompanyName /> }]);
  // jsdom no descarga imagenes: el evento "error" es lo que el navegador dispara cuando falla.
  fireEvent.error(await screen.findByRole("img", { name: /logo de la empresa/i }));

  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByText("Panadería Luna")).toBeInTheDocument();
});
