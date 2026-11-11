import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "../../../shared/test/renderWithProviders";
import { server } from "../../../shared/test/server";
import { AccountsReceivablePage } from "./AccountsReceivablePage";

const ACCOUNTS_RECEIVABLE_URL = "/api/v1/receipts/accounts-receivable";
const THIRD_PARTIES_URL = "/api/v1/third-parties";

const CLIENTE = {
  id: 1,
  tipo: "cliente",
  nombre: "Cliente Uno",
  documento: "",
  email: "",
  telefono: "",
  activo: true,
};

const RECIBO_CREDITO = {
  id: 1,
  tercero_id: 1,
  numero: "R-0002",
  fecha: "2026-11-11",
  condicion: "credito",
  fecha_vencimiento: "2026-12-01",
  estado: "emitido",
  subtotal: "10000.00",
  impuestos_total: "0.00",
  total: "10000.00",
  notas: "",
  saldo: "10000.00",
  lineas: [],
};

function renderPage() {
  renderWithProviders([{ path: "/", element: <AccountsReceivablePage /> }]);
}

it("muestra la página de Cuentas por cobrar con cliente, deuda y vencimiento", async () => {
  server.use(
    http.get(THIRD_PARTIES_URL, () => HttpResponse.json([CLIENTE])),
    http.get(ACCOUNTS_RECEIVABLE_URL, () => HttpResponse.json([RECIBO_CREDITO])),
  );

  renderPage();

  const row = await screen.findByRole("row", { name: /R-0002/ });
  expect(row).toHaveTextContent("Cliente Uno");
  expect(row).toHaveTextContent("10000.00");
  expect(row).toHaveTextContent("2026-12-01");
});
