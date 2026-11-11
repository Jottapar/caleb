import { Center, Drawer, Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { ItemForm } from "../components/ItemForm";
import { ItemTable } from "../components/ItemTable";
import { useCreateItem } from "../hooks/useCreateItem";
import { useItems } from "../hooks/useItems";
import { useUpdateItem } from "../hooks/useUpdateItem";
import type { Item, ItemCreate, ItemUpdate } from "../types";

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
  const updateItem = useUpdateItem();
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  function handleCreate(data: ItemCreate) {
    createItem.mutate(data);
  }

  function handleToggleActive(item: Item, activo: boolean) {
    updateItem.mutate({ id: item.id, data: { activo } });
  }

  function handleUpdate(data: ItemUpdate) {
    if (!editingItem) {
      return;
    }
    updateItem.mutate({ id: editingItem.id, data }, { onSuccess: () => setEditingItem(null) });
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

      {items.data && items.data.length > 0 && (
        <ItemTable
          items={items.data}
          onEdit={setEditingItem}
          onToggleActive={handleToggleActive}
        />
      )}

      {editingItem && (
        <Drawer.Root
          placement="end"
          open
          onOpenChange={(details) => !details.open && setEditingItem(null)}
        >
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Editar producto</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>
                <ItemForm
                  key={editingItem.id}
                  initialValues={editingItem}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingItem(null)}
                  isSubmitting={updateItem.isPending}
                  errorMessage={getErrorMessage(updateItem.isError, updateItem.error)}
                />
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>
      )}
    </Stack>
  );
}
