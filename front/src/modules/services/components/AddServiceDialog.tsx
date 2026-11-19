import {
  Button,
  Dialog,
  Field,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Text,
} from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { sanitizeDecimal } from "../../../shared/lib/formatters";
import { useCreateService } from "../hooks/useCreateService";
import { useServices } from "../hooks/useServices";
import type { Service } from "../types";

const ERROR_GENERICO = "No se pudo crear el servicio. Intenta de nuevo.";

type Props = {
  // Recibe el servicio elegido (existente o recién creado) y la cantidad que gasta la ficha
  onAdd: (service: Service, cantidad: string) => void;
  onClose: () => void;
};

export function AddServiceDialog({ onAdd, onClose }: Props) {
  const services = useServices();
  const createService = useCreateService();
  const [cantidad, setCantidad] = useState("1");
  const [selectedId, setSelectedId] = useState("");
  const [nombre, setNombre] = useState("");
  const [costo, setCosto] = useState("");

  // Solo los servicios activos se ofrecen para una ficha.
  const available = (services.data ?? []).filter((service) => service.activo);
  const selected =
    available.find((service) => service.id.toString() === selectedId) ??
    available[0];
  const cantidadValida = Number(cantidad) > 0;

  const errorMessage = !createService.isError
    ? null
    : isAxiosError(createService.error) &&
        createService.error.response?.data?.message
      ? createService.error.response.data.message
      : ERROR_GENERICO;

  function handleAddExisting() {
    if (selected && cantidadValida) {
      onAdd(selected, cantidad);
    }
  }

  function handleCreate() {
    if (!cantidadValida) {
      return;
    }
    createService.mutate(
      { nombre, costo: costo || "0" },
      { onSuccess: (service) => onAdd(service, cantidad) },
    );
  }

  return (
    <Dialog.Root
      open
      size="sm"
      onOpenChange={(details) => !details.open && onClose()}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Agregar servicio</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="4">
              <Text color="fg.muted">
                Un servicio es mano de obra: solo tiene costo. Se vende dentro
                de una ficha técnica.
              </Text>

              <Field.Root>
                <Field.Label>Cantidad</Field.Label>
                <Input
                  inputMode="decimal"
                  value={cantidad}
                  onChange={(event) =>
                    setCantidad(sanitizeDecimal(event.target.value))
                  }
                />
              </Field.Root>

              <Heading size="sm">Elegir un servicio existente</Heading>
              {available.length === 0 ? (
                <Text color="fg.muted">
                  Todavía no tienes servicios. Crea el primero abajo.
                </Text>
              ) : (
                <HStack align="end">
                  <Field.Root>
                    <Field.Label>Servicio</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={selected?.id.toString() ?? ""}
                        onChange={(event) => setSelectedId(event.target.value)}
                      >
                        {available.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.nombre}
                          </option>
                        ))}
                      </NativeSelect.Field>
                    </NativeSelect.Root>
                  </Field.Root>
                  <Button
                    type="button"
                    onClick={handleAddExisting}
                    disabled={!cantidadValida}
                  >
                    Agregar
                  </Button>
                </HStack>
              )}

              <Heading size="sm">O crear uno nuevo</Heading>
              <Field.Root>
                <Field.Label>Nombre del servicio</Field.Label>
                <Input
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Costo</Field.Label>
                <Input
                  inputMode="decimal"
                  value={costo}
                  onChange={(event) =>
                    setCosto(sanitizeDecimal(event.target.value))
                  }
                />
              </Field.Root>
              {errorMessage && <Text color="fg.error">{errorMessage}</Text>}
              <HStack>
                <Button
                  type="button"
                  colorPalette="brand"
                  loading={createService.isPending}
                  disabled={!nombre.trim() || !cantidadValida}
                  onClick={handleCreate}
                >
                  Crear y agregar
                </Button>
              </HStack>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
