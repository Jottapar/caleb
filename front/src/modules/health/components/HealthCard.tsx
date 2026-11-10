import { Badge, Card, HStack, Spinner, Text } from "@chakra-ui/react";

import { useHealth } from "../hooks/useHealth";

export function HealthCard() {
  const { data, isPending, isError } = useHealth();

  return (
    <Card.Root>
      <Card.Body>
        <HStack justify="space-between">
          <Card.Title>Conexión con el servidor</Card.Title>

          {isPending && (
            <HStack gap="2">
              <Spinner size="sm" />
              <Text color="fg.muted" fontSize="sm">
                Comprobando…
              </Text>
            </HStack>
          )}

          {isError && <Badge colorPalette="red">Sin conexión</Badge>}

          {data && (
            <Badge colorPalette={data.database === "ok" ? "green" : "red"}>
              {data.database === "ok" ? "Todo en orden" : "Base de datos caída"}
            </Badge>
          )}
        </HStack>

        {isError && (
          <Card.Description>
            No pudimos hablar con el servidor. Revisa que esté encendido.
          </Card.Description>
        )}

        {data && (
          <Card.Description>
            Entorno: <strong>{data.environment}</strong>
          </Card.Description>
        )}
      </Card.Body>
    </Card.Root>
  );
}
