import {
  Button,
  Dialog,
  Field,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";

import { formatCop, sanitizeDecimal } from "../../../shared/lib/formatters";
import { useTaxes } from "../../taxes";
import type { ServiceCreate, Supply } from "../types";

type SheetLine = {
  itemId: number;
  cantidad: string;
};

type Props = {
  supplies: Supply[]; // solo productos activos marcados como insumo
  onSubmit: (data: ServiceCreate) => void;
  onClose: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function CreateServiceDialog({
  supplies,
  onSubmit,
  onClose,
  isSubmitting,
  errorMessage,
}: Props) {
  const taxes = useTaxes();
  const [nombre, setNombre] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [impuestoId, setImpuestoId] = useState("");
  const [supplyId, setSupplyId] = useState(supplies[0]?.id.toString() ?? "");
  const [cantidad, setCantidad] = useState("");
  const [lineas, setLineas] = useState<SheetLine[]>([]);

  const impuestoSeleccionado = impuestoId || taxes.data?.[0]?.id.toString() || "";

  // Cada linea con los datos del insumo, para pintar nombre y costo sin guardarlos dos veces.
  const lineasConInsumo = lineas.flatMap((linea) => {
    const supply = supplies.find((candidate) => candidate.id === linea.itemId);
    return supply
      ? [
          {
            ...linea,
            supply,
            costoLinea: Number(supply.costo) * Number(linea.cantidad),
          },
        ]
      : [];
  });
  // Solo una vista previa: el costo de verdad lo calcula el backend con los costos del momento.
  const costoTotal = lineasConInsumo.reduce((total, linea) => total + linea.costoLinea, 0);

  function handleAddLine() {
    if (!supplyId || !cantidad || Number(cantidad) <= 0) {
      return;
    }
    const itemId = Number(supplyId);
    // Si el insumo ya estaba, se reemplaza su cantidad: un insumo no se repite en la ficha.
    setLineas((actuales) => [...actuales.filter((l) => l.itemId !== itemId), { itemId, cantidad }]);
    setCantidad("");
  }

  function handleRemoveLine(itemId: number) {
    setLineas((actuales) => actuales.filter((linea) => linea.itemId !== itemId));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      nombre,
      precio_venta: precioVenta || "0",
      impuesto_id: Number(impuestoSeleccionado),
      insumos: lineas.map((linea) => ({
        item_id: linea.itemId,
        cantidad: linea.cantidad,
      })),
    });
  }

  return (
    <Dialog.Root open size="lg" onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Crear servicio o ficha técnica</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack as="form" id="create-service-form" onSubmit={handleSubmit} gap="4">
              <Field.Root required>
                <Field.Label>Nombre</Field.Label>
                <Input value={nombre} onChange={(event) => setNombre(event.target.value)} />
              </Field.Root>

              <Field.Root>
                <Field.Label>Precio de venta</Field.Label>
                <Input
                  inputMode="decimal"
                  value={precioVenta}
                  onChange={(event) => setPrecioVenta(sanitizeDecimal(event.target.value))}
                />
              </Field.Root>

              <Field.Root required>
                <Field.Label>Impuesto</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={impuestoSeleccionado}
                    onChange={(event) => setImpuestoId(event.target.value)}
                  >
                    {taxes.data?.map((tax) => (
                      <option key={tax.id} value={tax.id}>
                        {tax.nombre}
                      </option>
                    ))}
                  </NativeSelect.Field>
                </NativeSelect.Root>
              </Field.Root>

              <Heading size="sm">Insumos que gasta un servicio</Heading>

              {supplies.length === 0 ? (
                <Text color="fg.muted">
                  No tienes productos marcados como insumo. Marca "Es insumo" en un producto para
                  poder usarlo aquí.
                </Text>
              ) : (
                <HStack align="end" wrap="wrap">
                  <Field.Root flex="2" minW="40">
                    <Field.Label>Insumo</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={supplyId}
                        onChange={(event) => setSupplyId(event.target.value)}
                      >
                        {supplies.map((supply) => (
                          <option key={supply.id} value={supply.id}>
                            {supply.nombre}
                          </option>
                        ))}
                      </NativeSelect.Field>
                    </NativeSelect.Root>
                  </Field.Root>
                  <Field.Root flex="1" minW="28">
                    <Field.Label>Cantidad</Field.Label>
                    <Input
                      inputMode="decimal"
                      value={cantidad}
                      onChange={(event) => setCantidad(sanitizeDecimal(event.target.value))}
                    />
                  </Field.Root>
                  <Button type="button" onClick={handleAddLine}>
                    Agregar insumo
                  </Button>
                </HStack>
              )}

              {lineasConInsumo.length > 0 && (
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Insumo</Table.ColumnHeader>
                      <Table.ColumnHeader>Cantidad</Table.ColumnHeader>
                      <Table.ColumnHeader>Costo</Table.ColumnHeader>
                      <Table.ColumnHeader></Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {lineasConInsumo.map((linea) => (
                      <Table.Row key={linea.itemId}>
                        <Table.Cell>{linea.supply.nombre}</Table.Cell>
                        <Table.Cell>{linea.cantidad}</Table.Cell>
                        <Table.Cell>{formatCop(String(linea.costoLinea))}</Table.Cell>
                        <Table.Cell>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveLine(linea.itemId)}
                          >
                            Quitar
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}

              <Text fontWeight="medium">Costo del servicio: {formatCop(String(costoTotal))}</Text>

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
                loading={isSubmitting}
                disabled={lineas.length === 0}
              >
                Crear servicio
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
