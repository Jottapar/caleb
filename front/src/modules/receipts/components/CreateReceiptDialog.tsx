import {
  Box,
  Button,
  Dialog,
  Field,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";

import type { Item } from "../../items/types";
import { CreateThirdPartyDialog, type ThirdParty } from "../../thirdParties";
import type { ReceiptCartLine } from "../types";

type Props = {
  thirdParties: ThirdParty[];
  items: Item[];
  terceroId: string;
  onTerceroChange: (terceroId: string) => void;
  condicion: string;
  onCondicionChange: (condicion: string) => void;
  fechaVencimiento: string;
  onFechaVencimientoChange: (fecha: string) => void;
  lineas: ReceiptCartLine[];
  onAddLine: (linea: ReceiptCartLine) => void;
  onRemoveLine: (itemId: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function CreateReceiptDialog({
  thirdParties,
  items,
  terceroId,
  onTerceroChange,
  condicion,
  onCondicionChange,
  fechaVencimiento,
  onFechaVencimientoChange,
  lineas,
  onAddLine,
  onRemoveLine,
  onConfirm,
  onClose,
  isSubmitting,
  errorMessage,
}: Props) {
  const [itemId, setItemId] = useState(items[0]?.id.toString() ?? "");
  const [cantidad, setCantidad] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const cliente = thirdParties.find(
    (tercero) => tercero.id.toString() === terceroId,
  );

  function handleAddLine() {
    const item = items.find((candidate) => candidate.id === Number(itemId));
    if (!item || !cantidad) {
      return;
    }
    onAddLine({ itemId: item.id, nombre: item.nombre, cantidad });
    setCantidad("");
  }

  return (
    <>
      <Dialog.Root open onOpenChange={(details) => !details.open && onClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Crear Recibo</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="4">
                <HStack align="end">
                  <Field.Root required>
                    <Field.Label>Cliente</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={terceroId}
                        onChange={(event) =>
                          onTerceroChange(event.target.value)
                        }
                      >
                        <option value="">Selecciona un cliente</option>
                        {thirdParties.map((tercero) => (
                          <option key={tercero.id} value={tercero.id}>
                            {tercero.nombre}
                          </option>
                        ))}
                      </NativeSelect.Field>
                    </NativeSelect.Root>
                  </Field.Root>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreatingClient(true)}
                  >
                    Crear cliente
                  </Button>
                </HStack>

                {/* Los datos del cliente elegido, para confirmar que es el correcto */}
                {cliente && (
                  <Box
                    borderWidth="1px"
                    borderRadius="md"
                    p="3"
                    aria-label="Datos del cliente"
                  >
                    <Stack gap="1">
                      <Text fontWeight="medium">{cliente.nombre}</Text>
                      <Text color="fg.muted">
                        Documento: {cliente.documento}
                      </Text>
                      <Text color="fg.muted">Correo: {cliente.email}</Text>
                      <Text color="fg.muted">Teléfono: {cliente.telefono}</Text>
                      <Text color="fg.muted">
                        Dirección: {cliente.direccion}
                      </Text>
                    </Stack>
                  </Box>
                )}

                {/* Producto y cantidad en la misma fila, con el botón de agregar al lado */}
                <HStack align="end">
                  <Field.Root required flex="2">
                    <Field.Label>Producto</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={itemId}
                        onChange={(event) => setItemId(event.target.value)}
                      >
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nombre}
                          </option>
                        ))}
                      </NativeSelect.Field>
                    </NativeSelect.Root>
                  </Field.Root>
                  <Field.Root required flex="1">
                    <Field.Label>Cantidad</Field.Label>
                    <Input
                      value={cantidad}
                      onChange={(event) => setCantidad(event.target.value)}
                    />
                  </Field.Root>
                  <Button type="button" onClick={handleAddLine}>
                    Agregar
                  </Button>
                </HStack>

                <Field.Root required>
                  <Field.Label>Condición</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={condicion}
                      onChange={(event) =>
                        onCondicionChange(event.target.value)
                      }
                    >
                      {/* Vacía a propósito: obliga a elegir, en vez de pasar con "contado" sin pensar */}
                      <option value="">Selecciona una condición</option>
                      <option value="contado">Contado</option>
                      <option value="credito">Crédito</option>
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>

                {condicion === "credito" && (
                  <Field.Root required>
                    <Field.Label>Fecha de vencimiento</Field.Label>
                    <Input
                      type="date"
                      value={fechaVencimiento}
                      onChange={(event) =>
                        onFechaVencimientoChange(event.target.value)
                      }
                    />
                  </Field.Root>
                )}

                {lineas.length > 0 && (
                  <Table.Root>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Producto</Table.ColumnHeader>
                        <Table.ColumnHeader>Cantidad</Table.ColumnHeader>
                        <Table.ColumnHeader></Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {lineas.map((linea) => (
                        <Table.Row key={linea.itemId}>
                          <Table.Cell>{linea.nombre}</Table.Cell>
                          <Table.Cell>{linea.cantidad}</Table.Cell>
                          <Table.Cell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onRemoveLine(linea.itemId)}
                            >
                              Quitar
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}

                {errorMessage && <Text color="fg.error">{errorMessage}</Text>}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack>
                <Button variant="outline" onClick={onClose}>
                  Cerrar
                </Button>
                <Button
                  colorPalette="brand"
                  loading={isSubmitting}
                  disabled={
                    lineas.length === 0 ||
                    !terceroId ||
                    !condicion ||
                    (condicion === "credito" && !fechaVencimiento)
                  }
                  onClick={onConfirm}
                >
                  Crear Recibo
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Hermano y no hijo del diálogo del recibo. Desde un recibo solo se crea un cliente o un
          "ambos": un proveedor no podría elegirse aquí. El cliente creado queda elegido. */}
      {creatingClient && (
        <CreateThirdPartyDialog
          title="Crear cliente"
          tipos={["cliente", "ambos"]}
          onCreated={(tercero) => onTerceroChange(tercero.id.toString())}
          onClose={() => setCreatingClient(false)}
        />
      )}
    </>
  );
}
