import { Button, Field, HStack, Input, NativeSelect } from "@chakra-ui/react";

import type { ThirdParty } from "../../thirdParties";

// "todas" y "todos" no son una condición ni un estado: son la ausencia de filtro.
export type ConditionFilter = "todas" | "contado" | "credito";
export type StatusFilter = "todos" | "emitido" | "anulado";

type Props = {
  clientes: ThirdParty[];
  terceroId: string; // "" significa todos los clientes
  desde: string; // fecha "AAAA-MM-DD"; "" significa sin límite
  hasta: string;
  condicion: ConditionFilter;
  estado: StatusFilter;
  onTerceroChange: (terceroId: string) => void;
  onDesdeChange: (fecha: string) => void;
  onHastaChange: (fecha: string) => void;
  onCondicionChange: (condicion: ConditionFilter) => void;
  onEstadoChange: (estado: StatusFilter) => void;
  onClear: () => void;
};

export function ReceiptFilters({
  clientes,
  terceroId,
  desde,
  hasta,
  condicion,
  estado,
  onTerceroChange,
  onDesdeChange,
  onHastaChange,
  onCondicionChange,
  onEstadoChange,
  onClear,
}: Props) {
  const hayFiltros = Boolean(
    terceroId || desde || hasta || condicion !== "todas" || estado !== "todos",
  );

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
        <Field.Label>Filtrar por condición</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={condicion}
            onChange={(event) =>
              onCondicionChange(event.target.value as ConditionFilter)
            }
          >
            <option value="todas">Todas</option>
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>

      <Field.Root width="auto">
        <Field.Label>Filtrar por estado</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={estado}
            onChange={(event) =>
              onEstadoChange(event.target.value as StatusFilter)
            }
          >
            <option value="todos">Todos</option>
            <option value="emitido">Activos</option>
            <option value="anulado">Cancelados</option>
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
