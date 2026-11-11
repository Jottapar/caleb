import { Button, Card, Field, Flex, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLogin } from "../hooks/useLogin";

const ERROR_GENERICO = "No se pudo iniciar sesión. Intenta de nuevo.";

// Tarjeta centrada sobre fondo gris, con una insignia de marca arriba del
// titulo: el mismo layout del boceto "Boceto Mini ERP" para esta pantalla.
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const login = useLogin();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: () => navigate("/") },
    );
  }

  const errorMessage = login.isError
    ? isAxiosError(login.error) && login.error.response?.data?.message
      ? login.error.response.data.message
      : ERROR_GENERICO
    : null;

  return (
    <Flex minH="100dvh" bg="bg.muted" align="center" justify="center" p="4">
      <Card.Root w="full" maxW="sm">
        <Card.Body>
          <Stack as="form" onSubmit={handleSubmit} gap="6">
            <Stack align="center" gap="2">
              <Flex
                w="12"
                h="12"
                borderRadius="lg"
                bg="brand.solid"
                color="brand.contrast"
                align="center"
                justify="center"
                fontSize="xl"
                fontWeight="bold"
              >
                C
              </Flex>
              <Heading size="lg">Caleb</Heading>
              <Text color="fg.muted" fontSize="sm">
                Ingresa a tu empresa
              </Text>
            </Stack>

            <Field.Root required>
              <Field.Label>Correo</Field.Label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field.Root>

            <Field.Root required>
              <Field.Label>Contraseña</Field.Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field.Root>

            {errorMessage && <Text color="fg.error">{errorMessage}</Text>}

            <Button type="submit" colorPalette="brand" loading={login.isPending}>
              Ingresar
            </Button>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Flex>
  );
}
