import { Box, Container, Flex, Heading, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";

type Props = {
  children?: ReactNode;
  // Debajo del titulo "Caleb", y a su lado a la derecha. `Layout` no sabe
  // nada de sesiones ni de empresas (shared/ nunca importa de modules/);
  // quien compone la ruta decide que mostrar ahi.
  subtitle?: ReactNode;
  headerActions?: ReactNode;
};

/**
 * Marco comun de todas las pantallas.
 *
 * Recibe `children` opcional y cae en `<Outlet />` si no se lo pasan: asi el
 * mismo componente sirve para las rutas normales (donde Outlet pinta la pagina
 * hija) y para la pantalla de error, que no tiene ruta hija que pintar.
 */
export function Layout({ children, subtitle, headerActions }: Props) {
  return (
    <Box minH="100dvh" bg="bg">
      <Box as="header" borderBottomWidth="1px" borderColor="border" bg="bg.panel">
        <Container maxW="5xl" py="4">
          <Flex justify="space-between" align="center">
            <Box>
              <Heading size="lg">Caleb</Heading>
              {subtitle ?? (
                <Text color="fg.muted" fontSize="sm">
                  Administración para tu negocio
                </Text>
              )}
            </Box>
            {headerActions}
          </Flex>
        </Container>
      </Box>

      <Container maxW="5xl" py="8" as="main">
        {children ?? <Outlet />}
      </Container>
    </Box>
  );
}
