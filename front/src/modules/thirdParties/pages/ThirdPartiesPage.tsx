import { Button, Center, Dialog, Drawer, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { TablePagination } from "../../../shared/components/ui/TablePagination";
import { normalizeText } from "../../../shared/lib/normalizeText";
import { ThirdPartyFilters, type TypeFilter } from "../components/ThirdPartyFilters";
import { ThirdPartyForm } from "../components/ThirdPartyForm";
import { ThirdPartyTable } from "../components/ThirdPartyTable";
import { useBanks } from "../hooks/useBanks";
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

function filterThirdParties(thirdParties: ThirdParty[], name: string, type: TypeFilter) {
  const search = normalizeText(name);
  return thirdParties.filter((thirdParty) => {
    // Un tercero "ambos" es cliente y proveedor a la vez: sale en los dos filtros.
    const matchesType =
      type === "todos" || thirdParty.tipo === type || thirdParty.tipo === "ambos";
    const matchesName = normalizeText(thirdParty.nombre).includes(search);
    return matchesType && matchesName;
  });
}

export function ThirdPartiesPage() {
  const thirdParties = useThirdParties();
  const banks = useBanks();
  const createThirdParty = useCreateThirdParty();
  const updateThirdParty = useUpdateThirdParty();
  const deleteThirdParty = useDeleteThirdParty();
  const [creating, setCreating] = useState(false);
  const [editingThirdParty, setEditingThirdParty] = useState<ThirdParty | null>(null);
  const [deletingThirdParty, setDeletingThirdParty] = useState<ThirdParty | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todos");

  // La API devuelve todos los terceros (los desplegables de Recibos los necesitan
  // completos). Primero se filtra y despues se pagina: la pagina se corta del
  // resultado filtrado, no de la lista completa.
  const filtered = filterThirdParties(thirdParties.data ?? [], nameFilter, typeFilter);
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

  function handleTypeFilterChange(type: TypeFilter) {
    setTypeFilter(type);
    setPage(1);
  }

  function handleOpenCreate() {
    // Limpia el error de un intento anterior para que no aparezca al reabrir la ventana.
    createThirdParty.reset();
    setCreating(true);
  }

  // La ventana se cierra solo si el backend guardó: si falla, queda abierta con los
  // datos escritos y el error a la vista para que el usuario corrija.
  function handleCreate(data: ThirdPartyCreate) {
    createThirdParty.mutate(data, { onSuccess: () => setCreating(false) });
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
      <HStack justify="space-between">
        <Heading size="xl">Clientes y proveedores</Heading>
        <Button colorPalette="brand" onClick={handleOpenCreate}>
          Crear cliente o proveedor
        </Button>
      </HStack>

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
        <>
          <ThirdPartyFilters
            name={nameFilter}
            type={typeFilter}
            onNameChange={handleNameFilterChange}
            onTypeChange={handleTypeFilterChange}
          />
          {total === 0 ? (
            <Text color="fg.muted">Ningún tercero coincide con el filtro.</Text>
          ) : (
            <>
              <ThirdPartyTable
                thirdParties={pageItems}
                onEdit={setEditingThirdParty}
                onToggleActive={handleToggleActive}
                onDelete={setDeletingThirdParty}
              />
              <TablePagination
                itemsPerPageLabel="Terceros por página"
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
        <Dialog.Root
          open
          onOpenChange={(details) => !details.open && setCreating(false)}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Crear cliente o proveedor</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <ThirdPartyForm
                  banks={banks.data ?? []}
                  banksError={banks.isError}
                  onSubmit={handleCreate}
                  onCancel={() => setCreating(false)}
                  isSubmitting={createThirdParty.isPending}
                  errorMessage={getErrorMessage(createThirdParty.isError, createThirdParty.error)}
                />
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
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
                  banks={banks.data ?? []}
                  banksError={banks.isError}
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
