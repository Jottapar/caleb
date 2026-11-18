import { Button, Checkbox, Field, HStack, Input, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import { useTaxes } from "../../taxes/hooks/useTaxes";
import { sanitizeDecimal } from "../formatters";
import type { Item, ItemCreate, ItemUpdate } from "../types";

type Props = (
  | { initialValues?: undefined; onSubmit: (data: ItemCreate) => void }
  | { initialValues: Item; onSubmit: (data: ItemUpdate) => void }
) & {
  onCancel?: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function ItemForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  errorMessage,
}: Props) {
  const taxes = useTaxes();
  const [nombre, setNombre] = useState(initialValues?.nombre ?? "");
  const [codigo, setCodigo] = useState(initialValues?.codigo ?? "");
  const [costo, setCosto] = useState(initialValues?.costo ?? "");
  const [precioVenta, setPrecioVenta] = useState(initialValues?.precio_venta ?? "");
  const [cantidadInicial, setCantidadInicial] = useState("");
  const [impuestoId, setImpuestoId] = useState(initialValues?.impuesto_id.toString() ?? "");
  // Al crear, por defecto un producto se vende y no es insumo (igual que los defaults del backend).
  const [seVende, setSeVende] = useState(initialValues?.se_vende ?? true);
  const [esInsumo, setEsInsumo] = useState(initialValues?.es_insumo ?? false);

  const impuestoSeleccionado = impuestoId || taxes.data?.[0]?.id.toString() || "";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (initialValues) {
      onSubmit({
        nombre,
        codigo,
        costo,
        precio_venta: precioVenta,
        impuesto_id: Number(impuestoSeleccionado),
        se_vende: seVende,
        es_insumo: esInsumo,
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
      se_vende: seVende,
      es_insumo: esInsumo,
    });
  }

  return (
    <Stack as="form" onSubmit={handleSubmit} gap="4">
      <Field.Root required>
        <Field.Label>Nombre</Field.Label>
        <Input value={nombre} onChange={(event) => setNombre(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Código</Field.Label>
        <Input value={codigo} onChange={(event) => setCodigo(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Costo</Field.Label>
        <Input
          inputMode="decimal"
          value={costo}
          onChange={(event) => setCosto(sanitizeDecimal(event.target.value))}
        />
      </Field.Root>

      <Field.Root>
        <Field.Label>Precio de venta</Field.Label>
        <Input
          inputMode="decimal"
          value={precioVenta}
          onChange={(event) => setPrecioVenta(sanitizeDecimal(event.target.value))}
        />
      </Field.Root>

      {!initialValues && (
        <Field.Root>
          <Field.Label>Cantidad inicial</Field.Label>
          <Input
            inputMode="decimal"
            value={cantidadInicial}
            onChange={(event) => setCantidadInicial(sanitizeDecimal(event.target.value))}
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

      <Stack gap="2">
        <Checkbox.Root checked={seVende} onCheckedChange={(e) => setSeVende(e.checked === true)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>Se vende</Checkbox.Label>
        </Checkbox.Root>
        <Checkbox.Root checked={esInsumo} onCheckedChange={(e) => setEsInsumo(e.checked === true)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>Es insumo</Checkbox.Label>
        </Checkbox.Root>
      </Stack>

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
