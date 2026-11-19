import { Button, Dialog, Field, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { sanitizeDecimal } from "../../../shared/lib/formatters";
import { useCreateService } from "../hooks/useCreateService";
import type { Service } from "../types";

const ERROR_GENERICO = "No se pudo crear el servicio. Intenta de nuevo.";

type Props = {
  onCreated: (service: Service) => void; // recibe el servicio recién creado
  onClose: () => void;
};

export function CreateServiceDialog({ onCreated, onClose }: Props) {
  const createService = useCreateService();
  const [nombre, setNombre] = useState("");
  const [costo, setCosto] = useState("");

  const errorMessage = !createService.isError
    ? null
    : isAxiosError(createService.error) && createService.error.response?.data?.message
      ? createService.error.response.data.message
      : ERROR_GENERICO;

  function handleSubmit(event: React.FormEvent) {
    // Esta ventana vive dentro de otra: sin esto el submit subiría al formulario de la ficha.
    event.stopPropagation();
    event.preventDefault();
    createService.mutate({ nombre, costo: costo || "0" }, { onSuccess: onCreated });
  }

  return (
    <Dialog.Root open size="sm" onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Crear servicio</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack as="form" id="create-service-form" onSubmit={handleSubmit} gap="4">
              <Text color="fg.muted">
                Un servicio es mano de obra: solo tiene costo. Se vende dentro de una ficha técnica.
              </Text>
              <Field.Root required>
                <Field.Label>Nombre del servicio</Field.Label>
                <Input value={nombre} onChange={(event) => setNombre(event.target.value)} />
              </Field.Root>
              <Field.Root>
                <Field.Label>Costo</Field.Label>
                <Input
                  inputMode="decimal"
                  value={costo}
                  onChange={(event) => setCosto(sanitizeDecimal(event.target.value))}
                />
              </Field.Root>
              {errorMessage && <Text color="fg.error">{errorMessage}</Text>}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack>
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                type="submit"
                form="create-service-form"
                colorPalette="brand"
                loading={createService.isPending}
              >
                Guardar servicio
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
