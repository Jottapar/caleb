import { Button, Center, Dialog, Drawer, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { ThirdPartyForm } from "../components/ThirdPartyForm";
import { ThirdPartyTable } from "../components/ThirdPartyTable";
import { useCreateThirdParty } from "../hooks/useCreateThirdParty";
import { useDeleteThirdParty } from "../hooks/useDeleteThirdParty";
import { useThirdParties } from "../hooks/useThirdParties";
import { useUpdateThirdParty } from "../hooks/useUpdateThirdParty";
import type { ThirdParty, ThirdPartyCreate } from "../types";

const ERROR_GENERICO_GUARDAR = "No se pudo guardar el tercero. Intenta de nuevo.";
const ERROR_GENERICO_ELIMINAR = "No se pudo eliminar el tercero. Intenta de nuevo.";

function getErrorMessage(isError: boolean, error: unknown, errorGenerico = ERROR_GENERICO_GUARDAR) {
  if (!isError) {
    return null;
  }
  return isAxiosError(error) && error.response?.data?.message
    ? error.response.data.message
    : errorGenerico;
}

export function ThirdPartiesPage() {
  const thirdParties = useThirdParties();
  const createThirdParty = useCreateThirdParty();
  const updateThirdParty = useUpdateThirdParty();
  const deleteThirdParty = useDeleteThirdParty();
  const [editingThirdParty, setEditingThirdParty] = useState<ThirdParty | null>(null);
  const [deletingThirdParty, setDeletingThirdParty] = useState<ThirdParty | null>(null);

  function handleCreate(data: ThirdPartyCreate) {
    createThirdParty.mutate(data);
  }

  function handleToggleActive(thirdParty: ThirdParty, activo: boolean) {
    updateThirdParty.mutate({ id: thirdParty.id, data: { activo } });
  }

  function handleConfirmDelete() {
    if (!deletingThirdParty) {
      return;
    }
    deleteThirdParty.mutate(deletingThirdParty.id, {
      onSuccess: () => setDeletingThirdParty(null),
    });
  }

  function handleUpdate(data: ThirdPartyCreate) {
    if (!editingThirdParty) {
      return;
    }
    updateThirdParty.mutate(
      { id: editingThirdParty.id, data },
      { onSuccess: () => setEditingThirdParty(null) },
    );
  }

  return (
    <Stack gap="6">
      <Heading size="xl">Clientes y proveedores</Heading>

      <ThirdPartyForm
        onSubmit={handleCreate}
        isSubmitting={createThirdParty.isPending}
        errorMessage={getErrorMessage(createThirdParty.isError, createThirdParty.error)}
      />

      {thirdParties.isPending && (
        <Center py="8">
          <Spinner />
        </Center>
      )}

      {thirdParties.isError && (
        <Text color="fg.error">No pudimos cargar tus terceros. Intenta de nuevo.</Text>
      )}

      {thirdParties.data && thirdParties.data.length === 0 && (
        <Text color="fg.muted">No tienes terceros registrados todavía.</Text>
      )}

      {thirdParties.data && thirdParties.data.length > 0 && (
        <ThirdPartyTable
          thirdParties={thirdParties.data}
          onEdit={setEditingThirdParty}
          onToggleActive={handleToggleActive}
          onDelete={setDeletingThirdParty}
        />
      )}

      {editingThirdParty && (
        <Drawer.Root
          placement="end"
          open
          onOpenChange={(details) => !details.open && setEditingThirdParty(null)}
        >
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Editar tercero</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>
                <ThirdPartyForm
                  key={editingThirdParty.id}
                  initialValues={editingThirdParty}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingThirdParty(null)}
                  isSubmitting={updateThirdParty.isPending}
                  errorMessage={getErrorMessage(updateThirdParty.isError, updateThirdParty.error)}
                />
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>
      )}

      {deletingThirdParty && (
        <Dialog.Root
          role="alertdialog"
          open
          onOpenChange={(details) => !details.open && setDeletingThirdParty(null)}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Eliminar a {deletingThirdParty.nombre}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  ¿Seguro que quieres eliminar a {deletingThirdParty.nombre}? Esta acción no se
                  puede deshacer.
                </Text>
                {getErrorMessage(
                  deleteThirdParty.isError,
                  deleteThirdParty.error,
                  ERROR_GENERICO_ELIMINAR,
                ) && (
                  <Text color="fg.error" mt="2">
                    {getErrorMessage(
                      deleteThirdParty.isError,
                      deleteThirdParty.error,
                      ERROR_GENERICO_ELIMINAR,
                    )}
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <HStack>
                  <Button variant="outline" onClick={() => setDeletingThirdParty(null)}>
                    Cancelar
                  </Button>
                  <Button
                    colorPalette="red"
                    loading={deleteThirdParty.isPending}
                    onClick={handleConfirmDelete}
                  >
                    Eliminar
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      )}
    </Stack>
  );
}
