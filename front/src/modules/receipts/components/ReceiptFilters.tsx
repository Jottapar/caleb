import { Button, Field, HStack, Input, NativeSelect } from "@chakra-ui/react";

import type { ThirdParty } from "../../thirdParties";

type Props = {
  clientes: ThirdParty[];
  terceroId: string; // "" significa todos los clientes
  desde: string; // fecha "AAAA-MM-DD"; "" significa sin límite
  hasta: string;
  onTerceroChange: (terceroId: string) => void;
  onDesdeChange: (fecha: string) => void;
  onHastaChange: (fecha: string) => void;
  onClear: () => void;
};

export function ReceiptFilters({
  clientes,
  terceroId,
  desde,
  hasta,
  onTerceroChange,
  onDesdeChange,
  onHastaChange,
  onClear,
}: Props) {
  const hayFiltros = Boolean(terceroId || desde || hasta);

  return (
    <HStack gap="4" align="end" wrap="wrap">
      <Field.Root width="auto" minW="48">
        <Field.Label>Filtrar por cliente</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={terceroId}
            onChange={(event) => onTerceroChange(event.target.value)}
          >
            <option value="">Todos</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>

      <Field.Root width="auto">
        <Field.Label>Emitido desde</Field.Label>
        <Input type="date" value={desde} onChange={(event) => onDesdeChange(event.target.value)} />
      </Field.Root>

      <Field.Root width="auto">
        <Field.Label>Emitido hasta</Field.Label>
        <Input type="date" value={hasta} onChange={(event) => onHastaChange(event.target.value)} />
      </Field.Root>

      {hayFiltros && (
        <Button variant="ghost" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </HStack>
  );
}
