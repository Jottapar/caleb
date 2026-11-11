import { Button, Field, Input, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import type { ThirdPartyCreate, ThirdPartyType } from "../types";

type Props = {
  onSubmit: (data: ThirdPartyCreate) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function ThirdPartyForm({ onSubmit, isSubmitting, errorMessage }: Props) {
  const [tipo, setTipo] = useState<ThirdPartyType>("cliente");
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({ tipo, nombre, documento, email, telefono });
    setNombre("");
    setDocumento("");
    setEmail("");
    setTelefono("");
  }

  return (
    <Stack as="form" onSubmit={handleSubmit} gap="4">
      <Field.Root required>
        <Field.Label>Tipo</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={tipo}
            onChange={(event) => setTipo(event.target.value as ThirdPartyType)}
          >
            <option value="cliente">Cliente</option>
            <option value="proveedor">Proveedor</option>
            <option value="ambos">Ambos</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>

      <Field.Root>
        <Field.Label>Nombre</Field.Label>
        <Input value={nombre} onChange={(event) => setNombre(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Documento</Field.Label>
        <Input value={documento} onChange={(event) => setDocumento(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Correo</Field.Label>
        <Input value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Teléfono</Field.Label>
        <Input value={telefono} onChange={(event) => setTelefono(event.target.value)} />
      </Field.Root>

      {errorMessage && <Text color="fg.error">{errorMessage}</Text>}

      <Button type="submit" colorPalette="brand" loading={isSubmitting} alignSelf="start">
        Guardar
      </Button>
    </Stack>
  );
}
