import { Table } from "@chakra-ui/react";

import type { Item } from "../types";

type Props = {
  items: Item[];
};

export function ItemTable({ items }: Props) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Código</Table.ColumnHeader>
          <Table.ColumnHeader>Nombre</Table.ColumnHeader>
          <Table.ColumnHeader>Costo</Table.ColumnHeader>
          <Table.ColumnHeader>Precio de venta</Table.ColumnHeader>
          <Table.ColumnHeader>Existencias</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map((item) => (
          <Table.Row key={item.id}>
            <Table.Cell>{item.codigo}</Table.Cell>
            <Table.Cell>{item.nombre}</Table.Cell>
            <Table.Cell>{item.costo}</Table.Cell>
            <Table.Cell>{item.precio_venta}</Table.Cell>
            <Table.Cell>{item.existencias}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
