import { Heading, Stack, Text } from "@chakra-ui/react";

import { HealthCard } from "../../health";

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

      <HealthCard />
    </Stack>
  );
}
