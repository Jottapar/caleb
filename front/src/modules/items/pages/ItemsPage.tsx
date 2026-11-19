import { Button, Center, Dialog, Drawer, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { TablePagination } from "../../../shared/components/ui/TablePagination";
import { normalizeText } from "../../../shared/lib/normalizeText";
import {
  CreateTechnicalSheetDialog,
  type TechnicalSheetCreate,
  useCreateTechnicalSheet,
  useTechnicalSheets,
} from "../../technicalSheets";
import { AddStockCartDialog } from "../components/AddStockCartDialog";
import { ItemFilters, type UseFilter } from "../components/ItemFilters";
import { ItemForm } from "../components/ItemForm";
import { ItemTable } from "../components/ItemTable";
import { useAddStockBulk } from "../hooks/useAddStockBulk";
import { useCreateItem } from "../hooks/useCreateItem";
import { useDeleteItem } from "../hooks/useDeleteItem";
import { useItems } from "../hooks/useItems";
import { useUpdateItem } from "../hooks/useUpdateItem";
import type { Item, ItemCreate, ItemUpdate, ProductRow, StockCartLine } from "../types";

const ERROR_GENERICO_GUARDAR = "No se pudo guardar el producto. Intenta de nuevo.";
const ERROR_GENERICO_ELIMINAR = "No se pudo eliminar el producto. Intenta de nuevo.";
const ERROR_GENERICO_AGREGAR = "No se pudo actualizar las existencias. Intenta de nuevo.";
const ERROR_GENERICO_FICHA = "No se pudo crear la ficha técnica. Intenta de nuevo.";

function getErrorMessage(isError: boolean, error: unknown, errorGenerico = ERROR_GENERICO_GUARDAR) {
  if (!isError) {
    return null;
  }
  return isAxiosError(error) && error.response?.data?.message
    ? error.response.data.message
    : errorGenerico;
}

function matchesUse(row: ProductRow, use: UseFilter) {
  if (use === "todos") {
    return true;
  }
  // Una ficha tecnica siempre se vende y nunca es insumo.
  if (row.kind === "sheet") {
    return use === "fichas" || use === "se_vende";
  }
  // Un producto puede venderse y ser insumo a la vez: sale en los dos filtros.
  return use !== "fichas" && row.item[use];
}

function filterRows(rows: ProductRow[], name: string, use: UseFilter) {
  const search = normalizeText(name);
  return rows.filter((row) => {
    const nombre = row.kind === "item" ? row.item.nombre : row.sheet.nombre;
    return matchesUse(row, use) && normalizeText(nombre).includes(search);
  });
}

export function ItemsPage() {
  const items = useItems();
  const sheets = useTechnicalSheets();
  const createSheet = useCreateTechnicalSheet();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const addStockBulk = useAddStockBulk();
  const [creating, setCreating] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [isAddStockDialogOpen, setIsAddStockDialogOpen] = useState(false);
  const [cartLines, setCartLines] = useState<StockCartLine[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [nameFilter, setNameFilter] = useState("");
  const [useFilter, setUseFilter] = useState<UseFilter>("todos");

  // Productos y fichas tecnicas van en la misma tabla: primero los productos, despues las fichas.
  const rows: ProductRow[] = [
    ...(items.data ?? []).map((item): ProductRow => ({ kind: "item", item })),
    ...(sheets.data ?? []).map((sheet): ProductRow => ({ kind: "sheet", sheet })),
  ];
  // Solo los productos activos marcados como insumo pueden entrar en una ficha tecnica.
  const supplies = (items.data ?? []).filter((item) => item.es_insumo && item.activo);
  const isPending = items.isPending || sheets.isPending;
  const isError = items.isError || sheets.isError;
  const hasData = Boolean(items.data && sheets.data);

  // La API devuelve todos los productos (los desplegables de Recibos los necesitan
  // completos). Primero se filtra y despues se pagina: la pagina se corta del
  // resultado filtrado, no de la lista completa.
  const filtered = filterRows(rows, nameFilter, useFilter);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Si al eliminar se vacia la ultima pagina, se muestra la anterior en vez de una vacia.
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handlePageSizeChange(newPageSize: number) {
    setPageSize(newPageSize);
    // Con otro tamano, la pagina en la que estaba ya no tiene sentido: vuelve a la primera.
    setPage(1);
  }

  // Con otro filtro los resultados son otros: se empieza desde la primera pagina.
  function handleNameFilterChange(name: string) {
    setNameFilter(name);
    setPage(1);
  }

  function handleUseFilterChange(use: UseFilter) {
    setUseFilter(use);
    setPage(1);
  }

  const deleteErrorMessage = getErrorMessage(
    deleteItem.isError,
    deleteItem.error,
    ERROR_GENERICO_ELIMINAR,
  );

  function handleOpenCreate() {
    // Limpia el error de un intento anterior para que no aparezca al reabrir la ventana.
    createItem.reset();
    setCreating(true);
  }

  function handleOpenCreateSheet() {
    createSheet.reset();
    setCreatingSheet(true);
  }

  function handleCreateSheet(data: TechnicalSheetCreate) {
    createSheet.mutate(data, { onSuccess: () => setCreatingSheet(false) });
  }

  // La ventana se cierra solo si el backend guardó: si falla, queda abierta con los
  // datos escritos y el error a la vista para que el usuario corrija.
  function handleCreate(data: ItemCreate) {
    createItem.mutate(data, { onSuccess: () => setCreating(false) });
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
      <HStack justify="space-between">
        <Heading size="xl">Productos</Heading>
        <HStack>
          <Button variant="outline" onClick={() => setIsAddStockDialogOpen(true)}>
            Agregar existencias
          </Button>
          <Button variant="outline" onClick={handleOpenCreateSheet}>
            Crear ficha técnica
          </Button>
          <Button colorPalette="brand" onClick={handleOpenCreate}>
            Crear producto
          </Button>
        </HStack>
      </HStack>

      {isPending && (
        <Center py="8">
          <Spinner />
        </Center>
      )}

      {isError && <Text color="fg.error">No pudimos cargar tus productos. Intenta de nuevo.</Text>}

      {hasData && rows.length === 0 && (
        <Text color="fg.muted">No tienes productos registrados todavía.</Text>
      )}

      {hasData && rows.length > 0 && (
        <>
          <ItemFilters
            name={nameFilter}
            use={useFilter}
            onNameChange={handleNameFilterChange}
            onUseChange={handleUseFilterChange}
          />
          {total === 0 ? (
            <Text color="fg.muted">Ningún producto coincide con el filtro.</Text>
          ) : (
            <>
              <ItemTable
                rows={pageItems}
                onEdit={setEditingItem}
                onToggleActive={handleToggleActive}
                onDelete={setDeletingItem}
              />
              <TablePagination
                itemsPerPageLabel="Productos por página"
                count={total}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}
        </>
      )}

      {creating && (
        <Dialog.Root open onOpenChange={(details) => !details.open && setCreating(false)}>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Crear producto</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <ItemForm
                  onSubmit={handleCreate}
                  onCancel={() => setCreating(false)}
                  isSubmitting={createItem.isPending}
                  errorMessage={getErrorMessage(createItem.isError, createItem.error)}
                />
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
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

      {creatingSheet && (
        <CreateTechnicalSheetDialog
          supplies={supplies}
          onSubmit={handleCreateSheet}
          onClose={() => setCreatingSheet(false)}
          isSubmitting={createSheet.isPending}
          errorMessage={getErrorMessage(createSheet.isError, createSheet.error, ERROR_GENERICO_FICHA)}
        />
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
