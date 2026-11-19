import { Button, Table } from "@chakra-ui/react";

import { formatCop, formatStock } from "../../../shared/lib/formatters";
import type { Item, ProductRow } from "../types";
import type { TechnicalSheet } from "../../technicalSheets";

type Props = {
  rows: ProductRow[];
  onEdit: (item: Item) => void;
  onEditSheet: (sheet: TechnicalSheet) => void;
  // Recibe la fila completa (producto o ficha) y el estado al que se quiere pasar.
  // Quien la usa decide si pide confirmación (desactivar) o cambia directo (activar).
  onSetActive: (row: ProductRow, activo: boolean) => void;
  onDelete: (item: Item) => void;
  onDeleteSheet: (sheet: TechnicalSheet) => void;
};

export function ItemTable({
  rows,
  onEdit,
  onEditSheet,
  onSetActive,
  onDelete,
  onDeleteSheet,
}: Props) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Código</Table.ColumnHeader>
          <Table.ColumnHeader>Nombre</Table.ColumnHeader>
          <Table.ColumnHeader>Costo</Table.ColumnHeader>
          <Table.ColumnHeader>Precio de venta</Table.ColumnHeader>
          <Table.ColumnHeader>Existencias</Table.ColumnHeader>
          <Table.ColumnHeader></Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => {
          const activo = row.kind === "sheet" ? row.sheet.activo : row.item.activo;
          // El mismo botón sirve en las dos vistas: en Activos desactiva, en Inactivos activa.
          const activeButton = (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSetActive(row, !activo)}
            >
              {activo ? "Desactivar" : "Activar"}
            </Button>
          );

          return row.kind === "sheet" ? (
            // Una ficha tecnica no tiene existencias propias: gasta las de sus insumos al venderse.
            <Table.Row key={`sheet-${row.sheet.id}`}>
              <Table.Cell>{row.sheet.codigo}</Table.Cell>
              <Table.Cell>{row.sheet.nombre}</Table.Cell>
              <Table.Cell>{formatCop(row.sheet.costo)}</Table.Cell>
              <Table.Cell>{formatCop(row.sheet.precio_venta)}</Table.Cell>
              <Table.Cell color="fg.muted">—</Table.Cell>
              <Table.Cell>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditSheet(row.sheet)}
                >
                  Editar
                </Button>
                {activeButton}
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="red"
                  onClick={() => onDeleteSheet(row.sheet)}
                >
                  Eliminar
                </Button>
              </Table.Cell>
            </Table.Row>
          ) : (
            <Table.Row key={`item-${row.item.id}`}>
              <Table.Cell>{row.item.codigo}</Table.Cell>
              <Table.Cell>{row.item.nombre}</Table.Cell>
              <Table.Cell>{formatCop(row.item.costo)}</Table.Cell>
              <Table.Cell>{formatCop(row.item.precio_venta)}</Table.Cell>
              <Table.Cell>{formatStock(row.item.existencias)}</Table.Cell>
              <Table.Cell>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(row.item)}
                >
                  Editar
                </Button>
                {activeButton}
                {/* Eliminar es para limpiar un producto registrado por error: solo si ya está
                    inactivo y nunca tuvo movimientos. Lo que ya se usó solo se desactiva. */}
                {!row.item.activo && !row.item.tiene_movimientos && (
                  <Button
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => onDelete(row.item)}
                  >
                    Eliminar
                  </Button>
                )}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
}
