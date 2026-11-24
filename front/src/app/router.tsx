import { Button, Link, Menu, Portal } from "@chakra-ui/react";
import { LuChevronDown } from "react-icons/lu";
import { createBrowserRouter, Link as RouterLink } from "react-router-dom";

import { CompanyName, LoginPage, LogoutButton, RequireAuth } from "../modules/auth";
import { CompanyPage } from "../modules/company";
import { HomePage } from "../modules/home";
import { ItemsPage } from "../modules/items";
import { AccountsReceivablePage, ReceiptsPage } from "../modules/receipts";
import { ThirdPartiesPage } from "../modules/thirdParties";
import { UsersPage } from "../modules/users";
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
      <RouterLink to="/clientes">Clientes</RouterLink>
    </Link>
    <Link asChild color="white" fontWeight="medium" px="2" py="1" borderRadius="md" bg="whiteAlpha.100">
      <RouterLink to="/proveedores">Proveedores</RouterLink>
    </Link>
    <Link asChild color="white" fontWeight="medium" px="2" py="1" borderRadius="md" bg="whiteAlpha.100">
      <RouterLink to="/productos">Productos</RouterLink>
    </Link>
    <Link asChild color="white" fontWeight="medium" px="2" py="1" borderRadius="md" bg="whiteAlpha.100">
      <RouterLink to="/recibos">Recibos</RouterLink>
    </Link>
    <Link asChild color="white" fontWeight="medium" px="2" py="1" borderRadius="md" bg="whiteAlpha.100">
      <RouterLink to="/cuentas-por-cobrar">Cuentas por cobrar</RouterLink>
    </Link>
    {/* Empresa es un submenú: sus datos y sus usuarios son dos páginas distintas. */}
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          variant="plain"
          h="auto"
          color="white"
          fontWeight="medium"
          px="2"
          py="1"
          borderRadius="md"
          bg="whiteAlpha.100"
          _hover={{ bg: "whiteAlpha.200" }}
        >
          Empresa
          <LuChevronDown />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="datos" asChild>
              <RouterLink to="/empresa">Datos</RouterLink>
            </Menu.Item>
            <Menu.Item value="usuarios" asChild>
              <RouterLink to="/empresa/usuarios">Usuarios</RouterLink>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
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
      // La misma pagina dos veces; el tipo decide que muestra y que crea.
      { path: "clientes", element: <ThirdPartiesPage tipo="cliente" /> },
      { path: "proveedores", element: <ThirdPartiesPage tipo="proveedor" /> },
      { path: "productos", element: <ItemsPage /> },
      { path: "recibos", element: <ReceiptsPage /> },
      { path: "cuentas-por-cobrar", element: <AccountsReceivablePage /> },
      { path: "empresa", element: <CompanyPage /> },
      { path: "empresa/usuarios", element: <UsersPage /> },
    ],
  },
]);
