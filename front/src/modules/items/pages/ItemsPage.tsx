import { Button, Center, Dialog, Drawer, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { AddStockCartDialog } from "../components/AddStockCartDialog";
import { ItemForm } from "../components/ItemForm";
import { ItemTable } from "../components/ItemTable";
import { useAddStockBulk } from "../hooks/useAddStockBulk";
import { useCreateItem } from "../hooks/useCreateItem";
import { useDeleteItem } from "../hooks/useDeleteItem";
import { useItems } from "../hooks/useItems";
import { useUpdateItem } from "../hooks/useUpdateItem";
import type { Item, ItemCreate, ItemUpdate, StockCartLine } from "../types";

const ERROR_GENERICO_GUARDAR = "No se pudo guardar el producto. Intenta de nuevo.";
const ERROR_GENERICO_ELIMINAR = "No se pudo eliminar el producto. Intenta de nuevo.";
const ERROR_GENERICO_AGREGAR = "No se pudo actualizar las existencias. Intenta de nuevo.";

function getErrorMessage(isError: boolean, error: unknown, errorGenerico = ERROR_GENERICO_GUARDAR) {
  if (!isError) {
    return null;
  }
  return isAxiosError(error) && error.response?.data?.message
    ? error.response.data.message
    : errorGenerico;
}

export function ItemsPage() {
  const items = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const addStockBulk = useAddStockBulk();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [isAddStockDialogOpen, setIsAddStockDialogOpen] = useState(false);
  const [cartLines, setCartLines] = useState<StockCartLine[]>([]);
  const deleteErrorMessage = getErrorMessage(
    deleteItem.isError,
    deleteItem.error,
    ERROR_GENERICO_ELIMINAR,
  );

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

  function handleCloseDeleteDialog() {
    setDeletingItem(null);
    deleteItem.reset();
  }

  function handleAddCartLine(linea: StockCartLine) {
    setCartLines((lineas) => [...lineas.filter((l) => l.itemId !== linea.itemId), linea]);
  }

  function handleRemoveCartLine(itemId: number) {
    setCartLines((lineas) => lineas.filter((linea) => linea.itemId !== itemId));
  }

  function handleConfirmDelete() {
    if (!deletingItem) {
      return;
    }
    deleteItem.mutate(deletingItem.id, {
      onSuccess: () => setDeletingItem(null),
    });
  }

  function handleCloseAddStockDialog() {
    setIsAddStockDialogOpen(false);
    addStockBulk.reset();
  }

  function handleConfirmAddStock() {
    addStockBulk.mutate(cartLines, {
      onSuccess: () => {
        setCartLines([]);
        setIsAddStockDialogOpen(false);
      },
    });
  }

  return (
    <Stack gap="6">
      <Heading size="xl">Productos y existencias</Heading>

      <ItemForm
        onSubmit={handleCreate}
        isSubmitting={createItem.isPending}
        errorMessage={getErrorMessage(createItem.isError, createItem.error)}
        extraActions={
          <Button type="button" variant="outline" onClick={() => setIsAddStockDialogOpen(true)}>
            Agregar existencias
          </Button>
        }
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
          onDelete={setDeletingItem}
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

      {deletingItem && (
        <Dialog.Root
          role="alertdialog"
          open
          onOpenChange={(details) => !details.open && handleCloseDeleteDialog()}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Eliminar {deletingItem.nombre}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  ¿Seguro que quieres eliminar {deletingItem.nombre}? Esta acción no se puede
                  deshacer.
                </Text>
                {deleteErrorMessage && (
                  <Text color="fg.error" mt="2">
                    {deleteErrorMessage}
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <HStack>
                  <Button variant="outline" onClick={handleCloseDeleteDialog}>
                    Cancelar
                  </Button>
                  <Button
                    colorPalette="red"
                    loading={deleteItem.isPending}
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

      {isAddStockDialogOpen && items.data && (
        <AddStockCartDialog
          items={items.data}
          lineas={cartLines}
          onAddLine={handleAddCartLine}
          onRemoveLine={handleRemoveCartLine}
          onConfirm={handleConfirmAddStock}
          onClose={handleCloseAddStockDialog}
          isSubmitting={addStockBulk.isPending}
          errorMessage={getErrorMessage(
            addStockBulk.isError,
            addStockBulk.error,
            ERROR_GENERICO_AGREGAR,
          )}
        />
      )}
    </Stack>
  );
}
