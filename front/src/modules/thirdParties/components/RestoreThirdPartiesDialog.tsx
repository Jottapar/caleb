import { Button, Center, Dialog, Spinner, Table, Text } from "@chakra-ui/react";

import { useDeletedThirdParties } from "../hooks/useDeletedThirdParties";
import { useRestoreThirdParty } from "../hooks/useRestoreThirdParty";
import type { ThirdPartyType } from "../types";

type Props = {
  title: string;
  emptyMessage: string;
  errorMessage: string;
  tipo: ThirdPartyType;
  onClose: () => void;
};

export function RestoreThirdPartiesDialog({ title, emptyMessage, errorMessage, tipo, onClose }: Props) {
  const deletedThirdParties = useDeletedThirdParties();
  const restoreThirdParty = useRestoreThirdParty();
  // La API devuelve los dos tipos juntos: aquí se queda solo el de esta pantalla.
  const ofType = (deletedThirdParties.data ?? []).filter((thirdParty) => thirdParty.tipo === tipo);

  return (
    <Dialog.Root open size="lg" onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            {deletedThirdParties.isPending && (
              <Center py="8">
                <Spinner />
              </Center>
            )}

            {deletedThirdParties.isError && <Text color="fg.error">{errorMessage}</Text>}

            {deletedThirdParties.data && ofType.length === 0 && (
              <Text color="fg.muted">{emptyMessage}</Text>
            )}

            {deletedThirdParties.data && ofType.length > 0 && (
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Nombre</Table.ColumnHeader>
                    <Table.ColumnHeader>Documento</Table.ColumnHeader>
                    <Table.ColumnHeader>Correo</Table.ColumnHeader>
                    <Table.ColumnHeader>Teléfono</Table.ColumnHeader>
                    <Table.ColumnHeader></Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {ofType.map((thirdParty) => (
                    <Table.Row key={thirdParty.id}>
                      <Table.Cell>{thirdParty.nombre}</Table.Cell>
                      <Table.Cell>{thirdParty.documento}</Table.Cell>
                      <Table.Cell>{thirdParty.email}</Table.Cell>
                      <Table.Cell>{thirdParty.telefono}</Table.Cell>
                      <Table.Cell textAlign="end">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={
                            restoreThirdParty.isPending && restoreThirdParty.variables === thirdParty.id
                          }
                          onClick={() => restoreThirdParty.mutate(thirdParty.id)}
                        >
                          Restaurar
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
