import { Center, Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";

import { ItemForm } from "../components/ItemForm";
import { ItemTable } from "../components/ItemTable";
import { useCreateItem } from "../hooks/useCreateItem";
import { useItems } from "../hooks/useItems";
import type { ItemCreate } from "../types";

const ERROR_GENERICO_GUARDAR = "No se pudo guardar el producto. Intenta de nuevo.";

function getErrorMessage(isError: boolean, error: unknown) {
  if (!isError) {
    return null;
  }
  return isAxiosError(error) && error.response?.data?.message
    ? error.response.data.message
    : ERROR_GENERICO_GUARDAR;
}

export function ItemsPage() {
  const items = useItems();
  const createItem = useCreateItem();

  function handleCreate(data: ItemCreate) {
    createItem.mutate(data);
  }

  return (
    <Stack gap="6">
      <Heading size="xl">Productos y existencias</Heading>

      <ItemForm
        onSubmit={handleCreate}
        isSubmitting={createItem.isPending}
        errorMessage={getErrorMessage(createItem.isError, createItem.error)}
      />

      {items.isPending && (
        <Center py="8">
          <Spinner />
        </Center>
      )}

      {items.isError && <Text color="fg.error">No pudimos cargar tus productos. Intenta de nuevo.</Text>}

      {items.data && items.data.length === 0 && (
        <Text color="fg.muted">No tienes productos registrados todavía.</Text>
      )}

      {items.data && items.data.length > 0 && <ItemTable items={items.data} />}
    </Stack>
  );
}
