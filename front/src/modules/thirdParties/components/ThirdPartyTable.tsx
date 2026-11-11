import { Button, Switch, Table } from "@chakra-ui/react";

import type { ThirdParty } from "../types";

type Props = {
  thirdParties: ThirdParty[];
  onEdit: (thirdParty: ThirdParty) => void;
  onToggleActive: (thirdParty: ThirdParty, activo: boolean) => void;
};

export function ThirdPartyTable({ thirdParties, onEdit, onToggleActive }: Props) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Tipo</Table.ColumnHeader>
          <Table.ColumnHeader>Nombre</Table.ColumnHeader>
          <Table.ColumnHeader>Documento</Table.ColumnHeader>
          <Table.ColumnHeader>Correo</Table.ColumnHeader>
          <Table.ColumnHeader>Teléfono</Table.ColumnHeader>
          <Table.ColumnHeader>Activo</Table.ColumnHeader>
          <Table.ColumnHeader></Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {thirdParties.map((thirdParty) => (
          <Table.Row key={thirdParty.id}>
            <Table.Cell>{thirdParty.tipo}</Table.Cell>
            <Table.Cell>{thirdParty.nombre}</Table.Cell>
            <Table.Cell>{thirdParty.documento}</Table.Cell>
            <Table.Cell>{thirdParty.email}</Table.Cell>
            <Table.Cell>{thirdParty.telefono}</Table.Cell>
            <Table.Cell>
              <Switch.Root
                checked={thirdParty.activo}
                onCheckedChange={(details) => onToggleActive(thirdParty, details.checked)}
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </Table.Cell>
            <Table.Cell>
              <Button size="sm" variant="ghost" onClick={() => onEdit(thirdParty)}>
                Editar
              </Button>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
