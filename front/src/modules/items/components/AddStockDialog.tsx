import { Button, Dialog, Field, HStack, Input, Text } from "@chakra-ui/react";
import { useState } from "react";

import type { Item } from "../types";

type Props = {
  item: Item;
  onConfirm: (cantidad: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function AddStockDialog({ item, onConfirm, onCancel, isSubmitting, errorMessage }: Props) {
  const [cantidad, setCantidad] = useState("");

  return (
    <Dialog.Root open onOpenChange={(details) => !details.open && onCancel()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Agregar existencias a {item.nombre}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Field.Root required>
              <Field.Label>Cantidad</Field.Label>
              <Input value={cantidad} onChange={(event) => setCantidad(event.target.value)} />
            </Field.Root>
            {errorMessage && (
              <Text color="fg.error" mt="2">
                {errorMessage}
              </Text>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <HStack>
              <Button variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                colorPalette="brand"
                loading={isSubmitting}
                onClick={() => onConfirm(cantidad)}
              >
                Agregar
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
