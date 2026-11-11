import { Button, Field, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLogin } from "../hooks/useLogin";

const ERROR_GENERICO = "No se pudo iniciar sesión. Intenta de nuevo.";

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
    <Stack as="form" onSubmit={handleSubmit} gap="4" maxW="sm" mx="auto">
      <Heading size="lg">Iniciar sesión</Heading>

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

      <Button type="submit" loading={login.isPending}>
        Iniciar sesión
      </Button>
    </Stack>
  );
}
