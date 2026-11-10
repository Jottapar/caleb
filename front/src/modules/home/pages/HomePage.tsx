import { Card, Heading, Stack, Text } from "@chakra-ui/react";

export function HomePage() {
  return (
    <Stack gap="6">
      <Stack gap="1">
        <Heading size="xl">Inicio</Heading>
        <Text color="fg.muted">
          Aquí vas a ver el resumen de tu negocio: lo que entra, lo que sale y lo
          que te deben.
        </Text>
      </Stack>

      <Card.Root>
        <Card.Body>
          <Card.Title>Todavía no hay nada que mostrar</Card.Title>
          <Card.Description>
            El resumen aparecerá cuando empieces a registrar recibos y gastos.
          </Card.Description>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
