import { Button, Field, HStack, Input, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import { useTaxes } from "../../taxes/hooks/useTaxes";
import type { Item, ItemCreate, ItemUpdate } from "../types";

type Props = {
  initialValues?: Item;
  onSubmit: (data: ItemCreate | ItemUpdate) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function ItemForm({ initialValues, onSubmit, onCancel, isSubmitting, errorMessage }: Props) {
  const taxes = useTaxes();
  const [nombre, setNombre] = useState(initialValues?.nombre ?? "");
  const [codigo, setCodigo] = useState("");
  const [costo, setCosto] = useState(initialValues?.costo ?? "");
  const [precioVenta, setPrecioVenta] = useState(initialValues?.precio_venta ?? "");
  const [cantidadInicial, setCantidadInicial] = useState("");
  const [impuestoId, setImpuestoId] = useState(initialValues?.impuesto_id.toString() ?? "");

  const impuestoSeleccionado = impuestoId || taxes.data?.[0]?.id.toString() || "";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (initialValues) {
      onSubmit({
        nombre,
        costo,
        precio_venta: precioVenta,
        impuesto_id: Number(impuestoSeleccionado),
      });
      return;
    }
    onSubmit({
      nombre,
      codigo,
      costo,
      precio_venta: precioVenta,
      cantidad_inicial: cantidadInicial,
      impuesto_id: Number(impuestoSeleccionado),
    });
    setNombre("");
    setCodigo("");
    setCosto("");
    setPrecioVenta("");
    setCantidadInicial("");
  }

  return (
    <Stack as="form" onSubmit={handleSubmit} gap="4">
      <Field.Root required>
        <Field.Label>Nombre</Field.Label>
        <Input value={nombre} onChange={(event) => setNombre(event.target.value)} />
      </Field.Root>

      {!initialValues && (
        <Field.Root>
          <Field.Label>Código</Field.Label>
          <Input value={codigo} onChange={(event) => setCodigo(event.target.value)} />
        </Field.Root>
      )}

      <Field.Root>
        <Field.Label>Costo</Field.Label>
        <Input value={costo} onChange={(event) => setCosto(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Precio de venta</Field.Label>
        <Input value={precioVenta} onChange={(event) => setPrecioVenta(event.target.value)} />
      </Field.Root>

      {!initialValues && (
        <Field.Root>
          <Field.Label>Cantidad inicial</Field.Label>
          <Input
            value={cantidadInicial}
            onChange={(event) => setCantidadInicial(event.target.value)}
          />
        </Field.Root>
      )}

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

      {errorMessage && <Text color="fg.error">{errorMessage}</Text>}

      <HStack>
        <Button type="submit" colorPalette="brand" loading={isSubmitting}>
          Guardar
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cerrar
          </Button>
        )}
      </HStack>
    </Stack>
  );
}
