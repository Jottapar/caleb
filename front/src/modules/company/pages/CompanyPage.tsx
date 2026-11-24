import { Heading, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";

import { CompanyForm } from "../components/CompanyForm";
import { useCompany } from "../hooks/useCompany";
import { useUpdateCompany } from "../hooks/useUpdateCompany";

const ERROR_GENERICO = "No se pudieron guardar los datos. Intenta de nuevo.";

export function CompanyPage() {
  const company = useCompany();
  const updateCompany = useUpdateCompany();

  // El backend responde los errores de negocio en espanol: se muestra tal cual.
  const errorMessage = !updateCompany.isError
    ? null
    : isAxiosError(updateCompany.error) && updateCompany.error.response?.data?.message
      ? updateCompany.error.response.data.message
      : ERROR_GENERICO;

  return (
    <Stack gap="6">
      <Heading size="xl">Empresa</Heading>

      {company.isPending && <Text color="fg.muted">Cargando los datos de la empresa…</Text>}
      {company.isError && (
        <Text color="fg.error">No pudimos cargar los datos de la empresa. Intenta de nuevo.</Text>
      )}
      {company.data && (
        <CompanyForm
          initialValues={company.data}
          onSubmitAttempt={() => updateCompany.reset()}
          onSubmit={(data) => updateCompany.mutate(data)}
          isSubmitting={updateCompany.isPending}
          errorMessage={errorMessage}
        />
      )}
      {updateCompany.isSuccess && (
        <Text role="status" color="fg.success">
          Datos guardados
        </Text>
      )}
    </Stack>
  );
}
