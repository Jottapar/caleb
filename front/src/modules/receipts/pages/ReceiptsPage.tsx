import { Button, Center, Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { useItems } from "../../items/hooks/useItems";
import { useThirdParties } from "../../thirdParties/hooks/useThirdParties";
import { CreateReceiptDialog } from "../components/CreateReceiptDialog";
import { ReceiptDetailDialog } from "../components/ReceiptDetailDialog";
import { ReceiptTable } from "../components/ReceiptTable";
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [terceroId, setTerceroId] = useState("");
  const [cartLines, setCartLines] = useState<ReceiptCartLine[]>([]);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);

  // Solo clientes (o "ambos") pueden ir en un recibo, y solo productos marcados para venderse
  const clientes = (thirdParties.data ?? []).filter(
    (tercero) => tercero.tipo === "cliente" || tercero.tipo === "ambos",
  );
  const vendibles = (items.data ?? []).filter((item) => item.se_vende);

  function handleOpenCreateDialog() {
    setTerceroId(clientes[0]?.id.toString() ?? "");
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

  function handleConfirmCreate() {
    createReceipt.mutate(
      { terceroId: Number(terceroId), lineas: cartLines },
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
        <ReceiptTable receipts={receipts.data} onView={setViewingReceipt} />
      )}

      {isCreateDialogOpen && (
        <CreateReceiptDialog
          thirdParties={clientes}
          items={vendibles}
          terceroId={terceroId}
          onTerceroChange={setTerceroId}
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
          clienteNombre={
            thirdParties.data?.find((tercero) => tercero.id === viewingReceipt.tercero_id)
              ?.nombre ?? ""
          }
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </Stack>
  );
}
