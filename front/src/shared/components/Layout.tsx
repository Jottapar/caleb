import { Box, Container, Heading, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";

type Props = {
  children?: ReactNode;
};

/**
 * Marco comun de todas las pantallas.
 *
 * Recibe `children` opcional y cae en `<Outlet />` si no se lo pasan: asi el
 * mismo componente sirve para las rutas normales (donde Outlet pinta la pagina
 * hija) y para la pantalla de error, que no tiene ruta hija que pintar.
 */
export function Layout({ children }: Props) {
  return (
    <Box minH="100dvh" bg="bg">
      <Box as="header" borderBottomWidth="1px" borderColor="border" bg="bg.panel">
        <Container maxW="5xl" py="4">
          <Heading size="lg">Caleb</Heading>
          <Text color="fg.muted" fontSize="sm">
            Administración para tu negocio
          </Text>
        </Container>
      </Box>

      <Container maxW="5xl" py="8" as="main">
        {children ?? <Outlet />}
      </Container>
    </Box>
  );
}
