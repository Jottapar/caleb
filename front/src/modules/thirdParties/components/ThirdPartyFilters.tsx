import { Field, HStack, Input, NativeSelect } from "@chakra-ui/react";

// "todos" no es un tipo de tercero: es la ausencia de filtro.
export type TypeFilter = "todos" | "cliente" | "proveedor";

type Props = {
  name: string;
  type: TypeFilter;
  onNameChange: (name: string) => void;
  onTypeChange: (type: TypeFilter) => void;
};

export function ThirdPartyFilters({ name, type, onNameChange, onTypeChange }: Props) {
  return (
    <HStack gap="4" align="end" wrap="wrap">
      <Field.Root maxW="sm">
        <Field.Label>Buscar tercero</Field.Label>
        <Input
          type="search"
          placeholder="Escribe un nombre"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </Field.Root>

      <Field.Root width="auto">
        <Field.Label>Filtrar por tipo</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={type}
            onChange={(event) => onTypeChange(event.target.value as TypeFilter)}
          >
            <option value="todos">Todos</option>
            <option value="cliente">Clientes</option>
            <option value="proveedor">Proveedores</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>
    </HStack>
  );
}
