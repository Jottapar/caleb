import { Heading, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";

import { useCurrentUser } from "../../auth";
import { CompanyForm } from "../components/CompanyForm";
import { useCompany } from "../hooks/useCompany";
import { LogoSaveError, useUpdateCompany } from "../hooks/useUpdateCompany";

const ERROR_GENERICO = "No se pudieron guardar los datos. Intenta de nuevo.";

// El mensaje en espanol que el backend manda en un error de negocio, si lo hay.
function backendMessage(error: unknown): string | null {
  return isAxiosError(error) ? (error.response?.data?.message ?? null) : null;
}

export function CompanyPage() {
  const company = useCompany();
  const updateCompany = useUpdateCompany();
  // El logo actual sale de /auth/me, la misma consulta que usa el encabezado.
  const me = useCurrentUser();

  // El backend responde los errores de negocio en espanol: se muestra tal cual.
  const errorMessage = !updateCompany.isError
    ? null
    : updateCompany.error instanceof LogoSaveError
      ? `Los datos se guardaron, pero el logo no: ${backendMessage(updateCompany.error.original) ?? "no se pudo guardar"}`
      : (backendMessage(updateCompany.error) ?? ERROR_GENERICO);

  return (
    <Stack gap="6">
      <Heading size="xl">Empresa</Heading>

      {(company.isPending || me.isPending) && (
        <Text color="fg.muted">Cargando los datos de la empresa…</Text>
      )}
      {company.isError && (
        <Text color="fg.error">No pudimos cargar los datos de la empresa. Intenta de nuevo.</Text>
      )}
      {/* Se espera a /auth/me (de ahi sale el logo actual): sin esto el formulario aparecería
          un instante como "sin logo". Si /auth/me falla se muestra igual, sin logo. */}
      {company.data && !me.isPending && (
        <CompanyForm
          initialValues={company.data}
          currentLogoVersion={me.data?.logo_version ?? ""}
          onSubmitAttempt={() => updateCompany.reset()}
          onSubmit={(data, logo, onSaved) =>
            updateCompany.mutate({ data, logo }, { onSuccess: onSaved })
          }
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
