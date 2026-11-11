import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { LogoutButton } from "./LogoutButton";

it("cierra sesión y termina en /login", async () => {
  server.use(
    http.post("/api/v1/auth/logout", () => HttpResponse.json({ message: "Sesión cerrada" })),
  );
  const user = userEvent.setup();

  renderWithProviders(
    [
      { path: "/", element: <LogoutButton /> },
      { path: "/login", element: <div>Pantalla de login</div> },
    ],
    { initialEntries: ["/"] },
  );

  await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

  expect(await screen.findByText("Pantalla de login")).toBeInTheDocument();
});
