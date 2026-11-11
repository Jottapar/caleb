import { Button, Dialog, Field, HStack, Input, NativeSelect, Stack, Table, Text } from "@chakra-ui/react";
import { useState } from "react";

import type { Item, StockCartLine } from "../types";

type Props = {
  items: Item[];
  lineas: StockCartLine[];
  onAddLine: (linea: StockCartLine) => void;
  onRemoveLine: (itemId: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function AddStockCartDialog({
  items,
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

  function handleAddLine() {
    const item = items.find((candidate) => candidate.id === Number(itemId));
    if (!item || !cantidad) {
      return;
    }
    onAddLine({ itemId: item.id, nombre: item.nombre, cantidad });
    setCantidad("");
  }

  return (
    <Dialog.Root open onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Agregar existencias</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="4">
              <Field.Root required>
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

              <Field.Root required>
                <Field.Label>Cantidad</Field.Label>
                <Input value={cantidad} onChange={(event) => setCantidad(event.target.value)} />
              </Field.Root>

              <HStack>
                <Button onClick={handleAddLine}>Agregar</Button>
              </HStack>

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
                disabled={lineas.length === 0}
                onClick={onConfirm}
              >
                Actualizar existencias
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
