import { Field, HStack, Input, NativeSelect } from "@chakra-ui/react";

// "todos" no es un uso: es la ausencia de filtro.
export type UseFilter = "todos" | "se_vende" | "es_insumo" | "servicios";

type Props = {
  name: string;
  use: UseFilter;
  onNameChange: (name: string) => void;
  onUseChange: (use: UseFilter) => void;
};

export function ItemFilters({ name, use, onNameChange, onUseChange }: Props) {
  return (
    <HStack gap="4" align="end" wrap="wrap">
      <Field.Root maxW="sm">
        <Field.Label>Buscar producto</Field.Label>
        <Input
          type="search"
          placeholder="Escribe un nombre"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </Field.Root>

      <Field.Root width="auto">
        <Field.Label>Filtrar por uso</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={use}
            onChange={(event) => onUseChange(event.target.value as UseFilter)}
          >
            <option value="todos">Todos</option>
            <option value="se_vende">Se venden</option>
            <option value="es_insumo">Insumos</option>
            <option value="servicios">Servicios</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>
    </HStack>
  );
}
