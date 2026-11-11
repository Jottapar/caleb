import { Center, Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";

import { ThirdPartyForm } from "../components/ThirdPartyForm";
import { ThirdPartyTable } from "../components/ThirdPartyTable";
import { useCreateThirdParty } from "../hooks/useCreateThirdParty";
import { useThirdParties } from "../hooks/useThirdParties";
import type { ThirdPartyCreate } from "../types";

const ERROR_GENERICO = "No se pudo guardar el tercero. Intenta de nuevo.";

export function ThirdPartiesPage() {
  const thirdParties = useThirdParties();
  const createThirdParty = useCreateThirdParty();

  function handleSubmit(data: ThirdPartyCreate) {
    createThirdParty.mutate(data);
  }

  const errorMessage = createThirdParty.isError
    ? isAxiosError(createThirdParty.error) && createThirdParty.error.response?.data?.message
      ? createThirdParty.error.response.data.message
      : ERROR_GENERICO
    : null;

  return (
    <Stack gap="6">
      <Heading size="xl">Clientes y proveedores</Heading>

      <ThirdPartyForm
        onSubmit={handleSubmit}
        isSubmitting={createThirdParty.isPending}
        errorMessage={errorMessage}
      />

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
        <ThirdPartyTable thirdParties={thirdParties.data} />
      )}
    </Stack>
  );
}
