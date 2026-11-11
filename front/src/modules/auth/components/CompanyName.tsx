import { Text } from "@chakra-ui/react";

import { useCurrentUser } from "../hooks/useCurrentUser";

export function CompanyName() {
  const { data } = useCurrentUser();

  if (!data) {
    return null;
  }

  return (
    // Se pinta en el encabezado oscuro de Layout: "fg.muted" quedaria
    // ilegible ahi, por eso usa un blanco atenuado en vez del token semantico.
    <Text color="whiteAlpha.800" fontSize="sm">
      {data.company_name}
    </Text>
  );
}
