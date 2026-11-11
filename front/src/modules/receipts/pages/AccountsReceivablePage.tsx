import { Center, Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import { useThirdParties } from "../../thirdParties/hooks/useThirdParties";
import { ReceiptDetailDialog } from "../components/ReceiptDetailDialog";
import { ReceiptTable } from "../components/ReceiptTable";
import { useAccountsReceivable } from "../hooks/useAccountsReceivable";
import type { Receipt } from "../types";

export function AccountsReceivablePage() {
  const accountsReceivable = useAccountsReceivable();
  const thirdParties = useThirdParties();
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);

  function getClienteNombre(terceroId: number) {
    return thirdParties.data?.find((tercero) => tercero.id === terceroId)?.nombre ?? "";
  }

  return (
    <Stack gap="6">
      <Heading size="xl">Cuentas por cobrar</Heading>

      {accountsReceivable.isPending && (
        <Center py="8">
          <Spinner />
        </Center>
      )}

      {accountsReceivable.isError && (
        <Text color="fg.error">No pudimos cargar las cuentas por cobrar. Intenta de nuevo.</Text>
      )}

      {accountsReceivable.data && accountsReceivable.data.length === 0 && (
        <Text color="fg.muted">No tienes cuentas por cobrar pendientes.</Text>
      )}

      {accountsReceivable.data && accountsReceivable.data.length > 0 && (
        <ReceiptTable
          receipts={accountsReceivable.data}
          getClienteNombre={getClienteNombre}
          onView={setViewingReceipt}
        />
      )}

      {viewingReceipt && (
        <ReceiptDetailDialog
          receipt={viewingReceipt}
          clienteNombre={getClienteNombre(viewingReceipt.tercero_id)}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </Stack>
  );
}
