import { Box, Container, Flex, Heading, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";

type Props = {
  children?: ReactNode;
  // Debajo del titulo "Caleb", la navegacion entre modulos, y las acciones a
  // la derecha. `Layout` no sabe nada de sesiones, empresas ni rutas (shared/
  // nunca importa de modules/); quien compone la ruta decide que mostrar ahi.
  subtitle?: ReactNode;
  nav?: ReactNode;
  headerActions?: ReactNode;
};

/**
 * Marco comun de todas las pantallas.
 *
 * Recibe `children` opcional y cae en `<Outlet />` si no se lo pasan: asi el
 * mismo componente sirve para las rutas normales (donde Outlet pinta la pagina
 * hija) y para la pantalla de error, que no tiene ruta hija que pintar.
 *
 * El encabezado es oscuro, con `flex-wrap`, igual que el boceto del front: en
 * pantallas angostas la marca, la navegacion y las acciones pasan a su propia
 * fila en vez de encimarse o desbordar.
 */
export function Layout({ children, subtitle, nav, headerActions }: Props) {
  return (
    <Box minH="100dvh" bg="bg.muted">
      <Box as="header" bg="gray.900" color="white">
        <Container maxW="6xl" py="3">
          <Flex wrap="wrap" align="center" gap="3" rowGap="2">
            <Box>
              <Heading size="md">Caleb</Heading>
              {subtitle ?? (
                <Text color="whiteAlpha.800" fontSize="sm">
                  Administración para tu negocio
                </Text>
              )}
            </Box>

            {nav && (
              <Flex wrap="wrap" gap="1" flexGrow="1">
                {nav}
              </Flex>
            )}

            {headerActions && (
              <Flex align="center" gap="3">
                {headerActions}
              </Flex>
            )}
          </Flex>
        </Container>
      </Box>

      <Container maxW="6xl" py={{ base: "6", md: "8" }} as="main">
        {children ?? <Outlet />}
      </Container>
    </Box>
  );
}
