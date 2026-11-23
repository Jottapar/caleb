import { Field, HStack, Input } from "@chakra-ui/react";

type Props = {
  label: string; // → "Buscar cliente"
  name: string;
  onNameChange: (name: string) => void;
};

// Solo se busca por nombre: el tipo ya lo filtra la pantalla (Clientes o Proveedores).
export function ThirdPartyFilters({ label, name, onNameChange }: Props) {
  return (
    <HStack gap="4" align="end" wrap="wrap">
      <Field.Root maxW="sm">
        <Field.Label>{label}</Field.Label>
        <Input
          type="search"
          placeholder="Escribe un nombre"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </Field.Root>
    </HStack>
  );
}
