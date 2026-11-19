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
import { CreateServiceDialog, useServices } from "../../services";
import { useTaxes } from "../../taxes";
import type { Supply, TechnicalSheetCreate } from "../types";

// Una linea guarda solo el id y la cantidad: el nombre y el costo se buscan en la lista
// del momento, para no tener los mismos datos copiados en dos sitios.
type SheetLine = {
  id: number;
  cantidad: string;
};

type Props = {
  supplies: Supply[]; // solo productos activos marcados como insumo
  onSubmit: (data: TechnicalSheetCreate) => void;
  onClose: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function CreateTechnicalSheetDialog({
  supplies,
  onSubmit,
  onClose,
  isSubmitting,
  errorMessage,
}: Props) {
  const taxes = useTaxes();
  const services = useServices();
  const [nombre, setNombre] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [impuestoId, setImpuestoId] = useState("");

  const [supplyId, setSupplyId] = useState(supplies[0]?.id.toString() ?? "");
  const [supplyCantidad, setSupplyCantidad] = useState("");
  const [supplyLines, setSupplyLines] = useState<SheetLine[]>([]);

  const [serviceLines, setServiceLines] = useState<SheetLine[]>([]);
  const [creatingService, setCreatingService] = useState(false);

  const impuestoSeleccionado = impuestoId || taxes.data?.[0]?.id.toString() || "";
  const serviceList = services.data ?? [];

  // Cada linea con los datos de su insumo o servicio, para pintar nombre y costo.
  const supplyRows = supplyLines.flatMap((linea) => {
    const supply = supplies.find((candidate) => candidate.id === linea.id);
    return supply
      ? [
          {
            key: `item-${linea.id}`,
            tipo: "Insumo",
            id: linea.id,
            nombre: supply.nombre,
            cantidad: linea.cantidad,
            costoLinea: Number(supply.costo) * Number(linea.cantidad),
          },
        ]
      : [];
  });
  const serviceRows = serviceLines.flatMap((linea) => {
    const service = serviceList.find((candidate) => candidate.id === linea.id);
    return service
      ? [
          {
            key: `service-${linea.id}`,
            tipo: "Servicio",
            id: linea.id,
            nombre: service.nombre,
            cantidad: linea.cantidad,
            costoLinea: Number(service.costo) * Number(linea.cantidad),
          },
        ]
      : [];
  });
  const rows = [...supplyRows, ...serviceRows];
  // Solo una vista previa: el costo de verdad lo calcula el backend con los costos del momento.
  const costoTotal = rows.reduce((total, row) => total + row.costoLinea, 0);
  const hasLines = supplyLines.length + serviceLines.length > 0;

  function handleAddSupply() {
    if (!supplyId || !supplyCantidad || Number(supplyCantidad) <= 0) {
      return;
    }
    const id = Number(supplyId);
    // Si el insumo ya estaba, se reemplaza su cantidad: un insumo no se repite en la ficha.
    setSupplyLines((actuales) => [
      ...actuales.filter((linea) => linea.id !== id),
      { id, cantidad: supplyCantidad },
    ]);
    setSupplyCantidad("");
  }

  function handleRemove(row: { tipo: string; id: number }) {
    const setLines = row.tipo === "Insumo" ? setSupplyLines : setServiceLines;
    setLines((actuales) => actuales.filter((linea) => linea.id !== row.id));
  }

  // El servicio recién creado entra de una vez a la ficha con cantidad 1 (se puede quitar
  // o volver a agregar con otra cantidad). Como el servicio es nuevo, no hace falta filtrar repetidos.
  function handleServiceCreated(service: { id: number }) {
    setServiceLines((actuales) => [...actuales, { id: service.id, cantidad: "1" }]);
    setCreatingService(false);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      nombre,
      precio_venta: precioVenta || "0",
      impuesto_id: Number(impuestoSeleccionado),
      insumos: supplyLines.map((linea) => ({ item_id: linea.id, cantidad: linea.cantidad })),
      servicios: serviceLines.map((linea) => ({
        servicio_id: linea.id,
        cantidad: linea.cantidad,
      })),
    });
  }

  return (
    <>
      <Dialog.Root open size="lg" onOpenChange={(details) => !details.open && onClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Crear ficha técnica</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack as="form" id="create-sheet-form" onSubmit={handleSubmit} gap="4">
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

                <Heading size="sm">Insumos que gasta una unidad</Heading>

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
                      <Field.Label>Cantidad de insumo</Field.Label>
                      <Input
                        inputMode="decimal"
                        value={supplyCantidad}
                        onChange={(event) => setSupplyCantidad(sanitizeDecimal(event.target.value))}
                      />
                    </Field.Root>
                    <Button type="button" onClick={handleAddSupply}>
                      Agregar insumo
                    </Button>
                  </HStack>
                )}

                {/* Los servicios no se eligen de una lista: se crean aquí y entran a la tabla. */}
                <HStack>
                  <Button type="button" variant="outline" onClick={() => setCreatingService(true)}>
                    Crear servicio
                  </Button>
                </HStack>

                {rows.length > 0 && (
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Tipo</Table.ColumnHeader>
                        <Table.ColumnHeader>Nombre</Table.ColumnHeader>
                        <Table.ColumnHeader>Cantidad</Table.ColumnHeader>
                        <Table.ColumnHeader>Costo</Table.ColumnHeader>
                        <Table.ColumnHeader></Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {rows.map((row) => (
                        <Table.Row key={row.key}>
                          <Table.Cell>{row.tipo}</Table.Cell>
                          <Table.Cell>{row.nombre}</Table.Cell>
                          <Table.Cell>{row.cantidad}</Table.Cell>
                          <Table.Cell>{formatCop(String(row.costoLinea))}</Table.Cell>
                          <Table.Cell>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemove(row)}
                            >
                              Quitar
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}

                <Text fontWeight="medium">Costo de la ficha: {formatCop(String(costoTotal))}</Text>

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
                  form="create-sheet-form"
                  colorPalette="brand"
                  loading={isSubmitting}
                  disabled={!hasLines}
                >
                  Crear ficha técnica
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Hermana y no hija del formulario: un <form> dentro de otro <form> no es HTML válido. */}
      {creatingService && (
        <CreateServiceDialog
          onCreated={handleServiceCreated}
          onClose={() => setCreatingService(false)}
        />
      )}
    </>
  );
}
