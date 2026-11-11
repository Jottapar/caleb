import { Link } from "@chakra-ui/react";
import { createBrowserRouter, Link as RouterLink } from "react-router-dom";

import { CompanyName, LoginPage, LogoutButton, RequireAuth } from "../modules/auth";
import { HomePage } from "../modules/home";
import { ThirdPartiesPage } from "../modules/thirdParties";
import { ErrorPage } from "../shared/components/ErrorPage";
import { Layout } from "../shared/components/Layout";

// A medida que se agreguen modulos (Recibos, Inventario, ...) sus links se
// suman aqui, no en Layout.
const nav = (
  <>
    <Link asChild color="white" fontWeight="medium" px="2" py="1" borderRadius="md" bg="whiteAlpha.100">
      <RouterLink to="/">Inicio</RouterLink>
    </Link>
    <Link asChild color="white" fontWeight="medium" px="2" py="1" borderRadius="md" bg="whiteAlpha.100">
      <RouterLink to="/terceros">Clientes y proveedores</RouterLink>
    </Link>
  </>
);

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <Layout subtitle={<CompanyName />} nav={nav} headerActions={<LogoutButton />} />
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "terceros", element: <ThirdPartiesPage /> },
    ],
  },
]);
