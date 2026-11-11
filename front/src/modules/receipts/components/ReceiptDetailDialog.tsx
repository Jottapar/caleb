import { Button, Dialog, HStack, Stack, Table, Text } from "@chakra-ui/react";

import type { Receipt } from "../types";

type Props = {
  receipt: Receipt;
  clienteNombre: string;
  onClose: () => void;
  onCancelRequest: () => void;
};

export function ReceiptDetailDialog({ receipt, clienteNombre, onClose, onCancelRequest }: Props) {
  return (
    <Dialog.Root open onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Recibo {receipt.numero}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="4">
              <Stack gap="1">
                <Text>Cliente: {clienteNombre}</Text>
                <Text>Fecha: {receipt.fecha}</Text>
                <Text>Estado: {receipt.estado}</Text>
              </Stack>

              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Producto</Table.ColumnHeader>
                    <Table.ColumnHeader>Cantidad</Table.ColumnHeader>
                    <Table.ColumnHeader>Precio</Table.ColumnHeader>
                    <Table.ColumnHeader>Total</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {receipt.lineas.map((linea) => (
                    <Table.Row key={linea.id}>
                      <Table.Cell>{linea.descripcion}</Table.Cell>
                      <Table.Cell>{linea.cantidad}</Table.Cell>
                      <Table.Cell>{linea.precio_unitario}</Table.Cell>
                      <Table.Cell>{linea.total_linea}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>

              <Stack gap="1">
                <Text>Subtotal: {receipt.subtotal}</Text>
                <Text>Impuesto: {receipt.impuestos_total}</Text>
                <Text fontWeight="bold">Total: {receipt.total}</Text>
              </Stack>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack>
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              {receipt.estado === "emitido" && (
                <Button colorPalette="red" variant="outline" onClick={onCancelRequest}>
                  Cancelar recibo
                </Button>
              )}
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
