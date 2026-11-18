import { Button, Switch, Table } from "@chakra-ui/react";

import { formatCop, formatStock } from "../../../shared/lib/formatters";
import type { Item, ProductRow } from "../types";

type Props = {
  rows: ProductRow[];
  onEdit: (item: Item) => void;
  onToggleActive: (item: Item, activo: boolean) => void;
  onDelete: (item: Item) => void;
};

export function ItemTable({ rows, onEdit, onToggleActive, onDelete }: Props) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Código</Table.ColumnHeader>
          <Table.ColumnHeader>Nombre</Table.ColumnHeader>
          <Table.ColumnHeader>Costo</Table.ColumnHeader>
          <Table.ColumnHeader>Precio de venta</Table.ColumnHeader>
          <Table.ColumnHeader>Existencias</Table.ColumnHeader>
          <Table.ColumnHeader>Activo</Table.ColumnHeader>
          <Table.ColumnHeader></Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) =>
          row.kind === "service" ? (
            // Un servicio no tiene existencias propias: gasta las de sus insumos al venderse.
            // Editarlo, activarlo y eliminarlo llegan en una parte siguiente.
            <Table.Row key={`service-${row.service.id}`}>
              <Table.Cell>{row.service.codigo}</Table.Cell>
              <Table.Cell>{row.service.nombre}</Table.Cell>
              <Table.Cell>{formatCop(row.service.costo)}</Table.Cell>
              <Table.Cell>{formatCop(row.service.precio_venta)}</Table.Cell>
              <Table.Cell color="fg.muted">—</Table.Cell>
              <Table.Cell></Table.Cell>
              <Table.Cell></Table.Cell>
            </Table.Row>
          ) : (
            <Table.Row key={`item-${row.item.id}`}>
              <Table.Cell>{row.item.codigo}</Table.Cell>
              <Table.Cell>{row.item.nombre}</Table.Cell>
              <Table.Cell>{formatCop(row.item.costo)}</Table.Cell>
              <Table.Cell>{formatCop(row.item.precio_venta)}</Table.Cell>
              <Table.Cell>{formatStock(row.item.existencias)}</Table.Cell>
              <Table.Cell>
                <Switch.Root
                  checked={row.item.activo}
                  onCheckedChange={(details) => onToggleActive(row.item, details.checked)}
                >
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Root>
              </Table.Cell>
              <Table.Cell>
                <Button size="sm" variant="ghost" onClick={() => onEdit(row.item)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="red"
                  onClick={() => onDelete(row.item)}
                >
                  Eliminar
                </Button>
              </Table.Cell>
            </Table.Row>
          ),
        )}
      </Table.Body>
    </Table.Root>
  );
}
