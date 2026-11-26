import { Button, Center, Dialog, Drawer, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { TablePagination } from "../../../shared/components/ui/TablePagination";
import { normalizeText } from "../../../shared/lib/normalizeText";
import { CreateThirdPartyDialog } from "../components/CreateThirdPartyDialog";
import { RestoreThirdPartiesDialog } from "../components/RestoreThirdPartiesDialog";
import { ThirdPartyFilters } from "../components/ThirdPartyFilters";
import { ThirdPartyForm } from "../components/ThirdPartyForm";
import { ThirdPartyTable } from "../components/ThirdPartyTable";
import { useBanks } from "../hooks/useBanks";
import { useDeleteThirdParty } from "../hooks/useDeleteThirdParty";
import { useThirdParties } from "../hooks/useThirdParties";
import { useUpdateThirdParty } from "../hooks/useUpdateThirdParty";
import type { ThirdParty, ThirdPartyCreate, ThirdPartyType } from "../types";

// Los textos de cada pantalla. Clientes y Proveedores son la misma página: solo cambian esto y
// el tipo que se muestra y se crea.
type Textos = {
  titulo: string;
  crear: string;
  restaurar: string;
  restaurarTitulo: string;
  sinSoftEliminados: string;
  errorSoftEliminados: string;
  editar: string;
  buscar: string;
  porPagina: string;
  errorCarga: string;
  vacio: string;
  sinCoincidencias: string;
};

const TEXTOS: Record<ThirdPartyType, Textos> = {
  cliente: {
    titulo: "Clientes",
    crear: "Crear cliente",
    restaurar: "Restaurar clientes",
    restaurarTitulo: "Clientes soft eliminados",
    sinSoftEliminados: "No tienes clientes soft eliminados.",
    errorSoftEliminados: "No pudimos cargar tus clientes soft eliminados. Intenta de nuevo.",
    editar: "Editar cliente",
    buscar: "Buscar cliente",
    porPagina: "Clientes por página",
    errorCarga: "No pudimos cargar tus clientes. Intenta de nuevo.",
    vacio: "No tienes clientes registrados todavía.",
    sinCoincidencias: "Ningún cliente coincide con la búsqueda.",
  },
  proveedor: {
    titulo: "Proveedores",
    crear: "Crear proveedor",
    restaurar: "Restaurar proveedores",
    restaurarTitulo: "Proveedores soft eliminados",
    sinSoftEliminados: "No tienes proveedores soft eliminados.",
    errorSoftEliminados: "No pudimos cargar tus proveedores soft eliminados. Intenta de nuevo.",
    editar: "Editar proveedor",
    buscar: "Buscar proveedor",
    porPagina: "Proveedores por página",
    errorCarga: "No pudimos cargar tus proveedores. Intenta de nuevo.",
    vacio: "No tienes proveedores registrados todavía.",
    sinCoincidencias: "Ningún proveedor coincide con la búsqueda.",
  },
};

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

function filterByName(thirdParties: ThirdParty[], name: string) {
  const search = normalizeText(name);
  return thirdParties.filter((thirdParty) => normalizeText(thirdParty.nombre).includes(search));
}

type Props = {
  // La pantalla de Clientes o la de Proveedores: muestra, crea y edita solo este tipo.
  tipo: ThirdPartyType;
};

export function ThirdPartiesPage({ tipo }: Props) {
  const textos = TEXTOS[tipo];
  const thirdParties = useThirdParties();
  const banks = useBanks();
  const updateThirdParty = useUpdateThirdParty();
  const deleteThirdParty = useDeleteThirdParty();
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [editingThirdParty, setEditingThirdParty] = useState<ThirdParty | null>(null);
  const [deletingThirdParty, setDeletingThirdParty] = useState<ThirdParty | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [nameFilter, setNameFilter] = useState("");

  // La API devuelve todos los terceros de la empresa, clientes y proveedores juntos. Aqui se
  // quedan solo los del tipo de esta pantalla; despues se busca por nombre y al final se
  // pagina: la pagina se corta del resultado filtrado, no de la lista completa.
  const ofType = (thirdParties.data ?? []).filter((thirdParty) => thirdParty.tipo === tipo);
  const filtered = filterByName(ofType, nameFilter);
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

  function handleOpenCreate() {
    setCreating(true);
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
        <Heading size="xl">{textos.titulo}</Heading>
        <HStack>
          <Button variant="outline" onClick={() => setRestoring(true)}>
            {textos.restaurar}
          </Button>
          <Button colorPalette="brand" onClick={handleOpenCreate}>
            {textos.crear}
          </Button>
        </HStack>
      </HStack>

      {thirdParties.isPending && (
        <Center py="8">
          <Spinner />
        </Center>
      )}

      {thirdParties.isError && <Text color="fg.error">{textos.errorCarga}</Text>}

      {/* "Vacío" es vacío de este tipo: puede haber proveedores y ningún cliente todavía. */}
      {thirdParties.data && ofType.length === 0 && (
        <Text color="fg.muted">{textos.vacio}</Text>
      )}

      {thirdParties.data && ofType.length > 0 && (
        <>
          <ThirdPartyFilters
            label={textos.buscar}
            name={nameFilter}
            onNameChange={handleNameFilterChange}
          />
          {total === 0 ? (
            <Text color="fg.muted">{textos.sinCoincidencias}</Text>
          ) : (
            <>
              <ThirdPartyTable
                thirdParties={pageItems}
                onEdit={setEditingThirdParty}
                onToggleActive={handleToggleActive}
                onDelete={setDeletingThirdParty}
              />
              <TablePagination
                itemsPerPageLabel={textos.porPagina}
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
        <CreateThirdPartyDialog
          title={textos.crear}
          tipo={tipo}
          onClose={() => setCreating(false)}
        />
      )}

      {restoring && (
        <RestoreThirdPartiesDialog
          title={textos.restaurarTitulo}
          emptyMessage={textos.sinSoftEliminados}
          errorMessage={textos.errorSoftEliminados}
          tipo={tipo}
          onClose={() => setRestoring(false)}
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
                <Drawer.Title>{textos.editar}</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>
                <ThirdPartyForm
                  key={editingThirdParty.id}
                  tipo={tipo}
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
                  ¿Seguro que quieres eliminar a {deletingThirdParty.nombre}? Dejará de verse en
                  la lista, pero podrás restaurarlo desde «{textos.restaurar}».
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
