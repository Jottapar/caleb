import { Flex, Text } from "@chakra-ui/react";

import { CompanyLogo } from "../../../shared/components/ui/CompanyLogo";
import { useCurrentUser } from "../hooks/useCurrentUser";

export function CompanyName() {
  const { data } = useCurrentUser();

  if (!data) {
    return null;
  }

  return (
    <Flex align="center" gap="2">
      {data.logo_version && <CompanyLogo version={data.logo_version} h="6" />}
      {/* Se pinta en el encabezado oscuro de Layout: "fg.muted" quedaria
          ilegible ahi, por eso usa un blanco atenuado en vez del token semantico. */}
      <Text color="whiteAlpha.800" fontSize="sm">
        {data.company_name}
      </Text>
    </Flex>
  );
}
