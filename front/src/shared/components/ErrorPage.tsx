import { Heading, Stack, Text } from "@chakra-ui/react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

import { Layout } from "./Layout";

/**
 * Se pinta cuando una ruta falla o no existe.
 *
 * Va envuelta en Layout para que el usuario no sienta que salio de la app.
 */
export function ErrorPage() {
  const error = useRouteError();

  const mensaje = isRouteErrorResponse(error)
    ? `${error.status} — esta página no existe`
    : "Algo salió mal";

  return (
    <Layout>
      <Stack gap="2">
        <Heading size="md">{mensaje}</Heading>
        <Text color="fg.muted">
          Revisa la dirección o vuelve al inicio.
        </Text>
      </Stack>
    </Layout>
  );
}
