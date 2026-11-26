import {
  Button,
  Center,
  Dialog,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { TablePagination } from "../../../shared/components/ui/TablePagination";
import { useItems } from "../../items/hooks/useItems";
import { useTechnicalSheets } from "../../technicalSheets";
import { useThirdParties } from "../../thirdParties/hooks/useThirdParties";
import { CreateReceiptDialog } from "../components/CreateReceiptDialog";
import { ReceiptDetailDialog } from "../components/ReceiptDetailDialog";
import {
  type ConditionFilter,
  ReceiptFilters,
  type StatusFilter,
} from "../components/ReceiptFilters";
import { ReceiptTable } from "../components/ReceiptTable";
import { useCancelReceipt } from "../hooks/useCancelReceipt";
import { useCreateReceipt } from "../hooks/useCreateReceipt";
import { useReceipts } from "../hooks/useReceipts";
import type { Receipt, ReceiptCartLine } from "../types";

const ERROR_GENERICO_CREAR = "No se pudo emitir el recibo. Intenta de nuevo.";

function getErrorMessage(isError: boolean, error: unknown) {
  if (!isError) {
    return null;
  }
  return isAxiosError(error) && error.response?.data?.message
    ? error.response.data.message
    : ERROR_GENERICO_CREAR;
}

type ReceiptFilterValues = {
  terceroId: string; // "" = todos los clientes
  desde: string; // "" = sin límite
  hasta: string;
  condicion: ConditionFilter;
  estado: StatusFilter;
};

// Filtra por cliente, condición, estado y fecha de emisión (desde y hasta, ambas inclusivas).
// Las fechas son texto "AAAA-MM-DD", así que comparar el texto es comparar las fechas.
function filterReceipts(receipts: Receipt[], filters: ReceiptFilterValues) {
  const { terceroId, desde, hasta, condicion, estado } = filters;
  return receipts.filter(
    (receipt) =>
      (!terceroId || receipt.tercero_id === Number(terceroId)) &&
      (condicion === "todas" || receipt.condicion === condicion) &&
      (estado === "todos" || receipt.estado === estado) &&
      (!desde || receipt.fecha >= desde) &&
      (!hasta || receipt.fecha <= hasta),
  );
}

// El más reciente primero: por fecha de emisión y, si empatan, el último creado.
function sortNewestFirst(receipts: Receipt[]) {
  return [...receipts].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id,
  );
}

export function ReceiptsPage() {
  const receipts = useReceipts();
  const thirdParties = useThirdParties();
  const items = useItems();
  const sheets = useTechnicalSheets();
  const createReceipt = useCreateReceipt();
  const cancelReceipt = useCancelReceipt();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [terceroId, setTerceroId] = useState("");
  const [condicion, setCondicion] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [cartLines, setCartLines] = useState<ReceiptCartLine[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [clienteFilter, setClienteFilter] = useState("");
  const [desdeFilter, setDesdeFilter] = useState("");
  const [hastaFilter, setHastaFilter] = useState("");
  const [condicionFilter, setCondicionFilter] =
    useState<ConditionFilter>("todas");
  const [estadoFilter, setEstadoFilter] = useState<StatusFilter>("todos");
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [cancelingReceipt, setCancelingReceipt] = useState<Receipt | null>(
    null,
  );

  // Solo clientes pueden ir en un recibo. Se vende lo que está activo: productos
  // marcados para venderse y fichas técnicas.
  const clientes = (thirdParties.data ?? []).filter(
    (tercero) => tercero.tipo === "cliente",
  );
  const vendibles = (items.data ?? []).filter(
    (item) => item.se_vende && item.activo,
  );
  const fichasVendibles = (sheets.data ?? []).filter((sheet) => sheet.activo);

  // Primero se filtra y después se pagina: la página se corta del resultado filtrado.
  const filtered = sortNewestFirst(
    filterReceipts(receipts.data ?? [], {
      terceroId: clienteFilter,
      desde: desdeFilter,
      hasta: hastaFilter,
      condicion: condicionFilter,
      estado: estadoFilter,
    }),
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Si la página en la que estaba ya no existe (por un filtro nuevo), se muestra la última.
  const currentPage = Math.min(page, totalPages);
  const pageReceipts = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function handlePageSizeChange(newPageSize: number) {
    setPageSize(newPageSize);
    setPage(1);
  }

  // Con otro filtro los resultados son otros: se empieza desde la primera página.
  function handleClienteFilterChange(terceroId: string) {
    setClienteFilter(terceroId);
    setPage(1);
  }

  function handleDesdeFilterChange(fecha: string) {
    setDesdeFilter(fecha);
    setPage(1);
  }

  function handleHastaFilterChange(fecha: string) {
    setHastaFilter(fecha);
    setPage(1);
  }

  function handleCondicionFilterChange(condicion: ConditionFilter) {
    setCondicionFilter(condicion);
    setPage(1);
  }

  function handleEstadoFilterChange(estado: StatusFilter) {
    setEstadoFilter(estado);
    setPage(1);
  }

  function handleClearFilters() {
    setCondicionFilter("todas");
    setEstadoFilter("todos");
    setClienteFilter("");
    setDesdeFilter("");
    setHastaFilter("");
    setPage(1);
  }

  function handleOpenCreateDialog() {
    // Cliente y condición empiezan vacíos para obligar al usuario a elegirlos
    setTerceroId("");
    setCondicion("");
    setFechaVencimiento("");
    setIsCreateDialogOpen(true);
  }

  function handleCloseCreateDialog() {
    setIsCreateDialogOpen(false);
    setCartLines([]);
    createReceipt.reset();
  }

  function handleAddCartLine(linea: ReceiptCartLine) {
    // Si ya estaba, se reemplaza su cantidad: un producto o ficha no se repite en el carrito.
    setCartLines((lineas) => [
      ...lineas.filter((l) => !(l.kind === linea.kind && l.id === linea.id)),
      linea,
    ]);
  }

  function handleRemoveCartLine(quitar: ReceiptCartLine) {
    setCartLines((lineas) =>
      lineas.filter((l) => !(l.kind === quitar.kind && l.id === quitar.id)),
    );
  }

  function handleCancelRequest() {
    setCancelingReceipt(viewingReceipt);
    setViewingReceipt(null);
  }

  function handleConfirmCancel() {
    if (!cancelingReceipt) {
      return;
    }
    cancelReceipt.mutate(cancelingReceipt.id, {
      onSuccess: () => setCancelingReceipt(null),
    });
  }

  function handleConfirmCreate() {
    createReceipt.mutate(
      {
        terceroId: Number(terceroId),
        lineas: cartLines,
        condicion,
        fechaVencimiento,
      },
      {
        onSuccess: () => {
          setCartLines([]);
          setIsCreateDialogOpen(false);
        },
      },
    );
  }

  return (
    <Stack gap="6">
      <Heading size="xl">Recibos</Heading>

      <Button
        alignSelf="flex-start"
        colorPalette="brand"
        onClick={handleOpenCreateDialog}
      >
        Crear Recibo
      </Button>

      {receipts.isPending && (
        <Center py="8">
          <Spinner />
        </Center>
      )}

      {receipts.isError && (
        <Text color="fg.error">
          No pudimos cargar tus recibos. Intenta de nuevo.
        </Text>
      )}

      {receipts.data && receipts.data.length === 0 && (
        <Text color="fg.muted">No tienes recibos emitidos todavía.</Text>
      )}

      {receipts.data && receipts.data.length > 0 && (
        <>
          <ReceiptFilters
            clientes={clientes}
            terceroId={clienteFilter}
            desde={desdeFilter}
            hasta={hastaFilter}
            condicion={condicionFilter}
            estado={estadoFilter}
            onTerceroChange={handleClienteFilterChange}
            onDesdeChange={handleDesdeFilterChange}
            onHastaChange={handleHastaFilterChange}
            onCondicionChange={handleCondicionFilterChange}
            onEstadoChange={handleEstadoFilterChange}
            onClear={handleClearFilters}
          />
          {total === 0 ? (
            <Text color="fg.muted">Ningún recibo coincide con el filtro.</Text>
          ) : (
            <>
              <ReceiptTable
                receipts={pageReceipts}
                onView={setViewingReceipt}
              />
              <TablePagination
                itemsPerPageLabel="Recibos por página"
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

      {isCreateDialogOpen && (
        <CreateReceiptDialog
          thirdParties={clientes}
          items={vendibles}
          sheets={fichasVendibles}
          terceroId={terceroId}
          onTerceroChange={setTerceroId}
          condicion={condicion}
          onCondicionChange={setCondicion}
          fechaVencimiento={fechaVencimiento}
          onFechaVencimientoChange={setFechaVencimiento}
          lineas={cartLines}
          onAddLine={handleAddCartLine}
          onRemoveLine={handleRemoveCartLine}
          onConfirm={handleConfirmCreate}
          onClose={handleCloseCreateDialog}
          isSubmitting={createReceipt.isPending}
          errorMessage={getErrorMessage(
            createReceipt.isError,
            createReceipt.error,
          )}
        />
      )}

      {viewingReceipt && (
        <ReceiptDetailDialog
          receipt={viewingReceipt}
          clienteNombre={viewingReceipt.cliente_nombre}
          onClose={() => setViewingReceipt(null)}
          onCancelRequest={handleCancelRequest}
        />
      )}

      {cancelingReceipt && (
        <Dialog.Root
          role="alertdialog"
          open
          onOpenChange={(details) => !details.open && setCancelingReceipt(null)}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  Cancelar recibo {cancelingReceipt.numero}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  ¿Seguro que quieres cancelar el recibo{" "}
                  {cancelingReceipt.numero}? El inventario que descontó vuelve a
                  su cantidad anterior y sus pagos, si tiene, quedan anulados.
                  Esta acción no se puede deshacer.
                </Text>
                {getErrorMessage(
                  cancelReceipt.isError,
                  cancelReceipt.error,
                ) && (
                  <Text color="fg.error" mt="2">
                    {getErrorMessage(
                      cancelReceipt.isError,
                      cancelReceipt.error,
                    )}
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <HStack>
                  <Button
                    variant="outline"
                    onClick={() => setCancelingReceipt(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    colorPalette="red"
                    loading={cancelReceipt.isPending}
                    onClick={handleConfirmCancel}
                  >
                    Cancelar recibo
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
