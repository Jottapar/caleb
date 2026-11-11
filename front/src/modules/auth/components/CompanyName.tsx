import { Text } from "@chakra-ui/react";

import { useCurrentUser } from "../hooks/useCurrentUser";

export function CompanyName() {
  const { data } = useCurrentUser();

  if (!data) {
    return null;
  }

  return (
    <Text color="fg.muted" fontSize="sm">
      {data.company_name}
    </Text>
  );
}
