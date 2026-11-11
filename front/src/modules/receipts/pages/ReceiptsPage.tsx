import { Button, Center, Dialog, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { useItems } from "../../items/hooks/useItems";
import { useThirdParties } from "../../thirdParties/hooks/useThirdParties";
import { CreateReceiptDialog } from "../components/CreateReceiptDialog";
import { ReceiptDetailDialog } from "../components/ReceiptDetailDialog";
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

export function ReceiptsPage() {
  const receipts = useReceipts();
  const thirdParties = useThirdParties();
  const items = useItems();
  const createReceipt = useCreateReceipt();
  const cancelReceipt = useCancelReceipt();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [terceroId, setTerceroId] = useState("");
  const [condicion, setCondicion] = useState("contado");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [cartLines, setCartLines] = useState<ReceiptCartLine[]>([]);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [cancelingReceipt, setCancelingReceipt] = useState<Receipt | null>(null);

  // Solo clientes (o "ambos") pueden ir en un recibo, y solo productos marcados para venderse
  const clientes = (thirdParties.data ?? []).filter(
    (tercero) => tercero.tipo === "cliente" || tercero.tipo === "ambos",
  );
  const vendibles = (items.data ?? []).filter((item) => item.se_vende);

  function getClienteNombre(terceroId: number) {
    return thirdParties.data?.find((tercero) => tercero.id === terceroId)?.nombre ?? "";
  }

  function handleOpenCreateDialog() {
    setTerceroId(clientes[0]?.id.toString() ?? "");
    setCondicion("contado");
    setFechaVencimiento("");
    setIsCreateDialogOpen(true);
  }

  function handleCloseCreateDialog() {
    setIsCreateDialogOpen(false);
    setCartLines([]);
    createReceipt.reset();
  }

  function handleAddCartLine(linea: ReceiptCartLine) {
    setCartLines((lineas) => [...lineas.filter((l) => l.itemId !== linea.itemId), linea]);
  }

  function handleRemoveCartLine(itemId: number) {
    setCartLines((lineas) => lineas.filter((linea) => linea.itemId !== itemId));
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
      { terceroId: Number(terceroId), lineas: cartLines, condicion, fechaVencimiento },
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

      <Button alignSelf="flex-start" colorPalette="brand" onClick={handleOpenCreateDialog}>
        Crear Recibo
      </Button>

      {receipts.isPending && (
        <Center py="8">
          <Spinner />
        </Center>
      )}

      {receipts.isError && (
        <Text color="fg.error">No pudimos cargar tus recibos. Intenta de nuevo.</Text>
      )}

      {receipts.data && receipts.data.length === 0 && (
        <Text color="fg.muted">No tienes recibos emitidos todavía.</Text>
      )}

      {receipts.data && receipts.data.length > 0 && (
        <ReceiptTable
          receipts={receipts.data}
          getClienteNombre={getClienteNombre}
          onView={setViewingReceipt}
        />
      )}

      {isCreateDialogOpen && (
        <CreateReceiptDialog
          thirdParties={clientes}
          items={vendibles}
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
          errorMessage={getErrorMessage(createReceipt.isError, createReceipt.error)}
        />
      )}

      {viewingReceipt && (
        <ReceiptDetailDialog
          receipt={viewingReceipt}
          clienteNombre={getClienteNombre(viewingReceipt.tercero_id)}
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
                <Dialog.Title>Cancelar recibo {cancelingReceipt.numero}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  ¿Seguro que quieres cancelar el recibo {cancelingReceipt.numero}? El inventario
                  que descontó vuelve a su cantidad anterior y el pago registrado queda anulado.
                  Esta acción no se puede deshacer.
                </Text>
                {getErrorMessage(cancelReceipt.isError, cancelReceipt.error) && (
                  <Text color="fg.error" mt="2">
                    {getErrorMessage(cancelReceipt.isError, cancelReceipt.error)}
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <HStack>
                  <Button variant="outline" onClick={() => setCancelingReceipt(null)}>
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
