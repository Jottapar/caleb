import { Center, Drawer, Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { ThirdPartyForm } from "../components/ThirdPartyForm";
import { ThirdPartyTable } from "../components/ThirdPartyTable";
import { useCreateThirdParty } from "../hooks/useCreateThirdParty";
import { useThirdParties } from "../hooks/useThirdParties";
import { useUpdateThirdParty } from "../hooks/useUpdateThirdParty";
import type { ThirdParty, ThirdPartyCreate } from "../types";

const ERROR_GENERICO = "No se pudo guardar el tercero. Intenta de nuevo.";

function getErrorMessage(isError: boolean, error: unknown) {
  if (!isError) {
    return null;
  }
  return isAxiosError(error) && error.response?.data?.message
    ? error.response.data.message
    : ERROR_GENERICO;
}

export function ThirdPartiesPage() {
  const thirdParties = useThirdParties();
  const createThirdParty = useCreateThirdParty();
  const updateThirdParty = useUpdateThirdParty();
  const [editingThirdParty, setEditingThirdParty] = useState<ThirdParty | null>(null);

  function handleCreate(data: ThirdPartyCreate) {
    createThirdParty.mutate(data);
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
        <ThirdPartyTable thirdParties={thirdParties.data} onEdit={setEditingThirdParty} />
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
    </Stack>
  );
}
