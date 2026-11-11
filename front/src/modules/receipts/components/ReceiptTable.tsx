import { Button, Table } from "@chakra-ui/react";

import type { Receipt } from "../types";

type Props = {
  receipts: Receipt[];
  getClienteNombre: (terceroId: number) => string;
  onView: (receipt: Receipt) => void;
};

export function ReceiptTable({ receipts, getClienteNombre, onView }: Props) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Número</Table.ColumnHeader>
          <Table.ColumnHeader>Cliente</Table.ColumnHeader>
          <Table.ColumnHeader>Fecha</Table.ColumnHeader>
          <Table.ColumnHeader>Vencimiento</Table.ColumnHeader>
          <Table.ColumnHeader>Total</Table.ColumnHeader>
          <Table.ColumnHeader>Deuda</Table.ColumnHeader>
          <Table.ColumnHeader>Estado</Table.ColumnHeader>
          <Table.ColumnHeader></Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {receipts.map((receipt) => (
          <Table.Row key={receipt.id}>
            <Table.Cell>{receipt.numero}</Table.Cell>
            <Table.Cell>{getClienteNombre(receipt.tercero_id)}</Table.Cell>
            <Table.Cell>{receipt.fecha}</Table.Cell>
            <Table.Cell>{receipt.fecha_vencimiento}</Table.Cell>
            <Table.Cell>{receipt.total}</Table.Cell>
            <Table.Cell>{receipt.saldo}</Table.Cell>
            <Table.Cell>{receipt.estado}</Table.Cell>
            <Table.Cell>
              <Button size="sm" variant="ghost" onClick={() => onView(receipt)}>
                Ver
              </Button>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
