import { Button, Field, HStack, Input, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import type { ThirdParty, ThirdPartyCreate, ThirdPartyType } from "../types";

type Props = {
  initialValues?: ThirdParty;
  onSubmit: (data: ThirdPartyCreate) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function ThirdPartyForm({ initialValues, onSubmit, onCancel, isSubmitting, errorMessage }: Props) {
  const [tipo, setTipo] = useState<ThirdPartyType>(initialValues?.tipo ?? "cliente");
  const [nombre, setNombre] = useState(initialValues?.nombre ?? "");
  const [documento, setDocumento] = useState(initialValues?.documento ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [telefono, setTelefono] = useState(initialValues?.telefono ?? "");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({ tipo, nombre, documento, email, telefono });
    if (!initialValues) {
      setNombre("");
      setDocumento("");
      setEmail("");
      setTelefono("");
    }
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

      <HStack>
        <Button type="submit" colorPalette="brand" loading={isSubmitting}>
          Guardar
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cerrar
          </Button>
        )}
      </HStack>
    </Stack>
  );
}
