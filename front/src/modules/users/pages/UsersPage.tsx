import { Button, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import { CreateUserDialog } from "../components/CreateUserDialog";
import type { User } from "../types";

// Los usuarios de la empresa. El listado llega en la historia 16b, debajo de este botón.
export function UsersPage() {
  const [creating, setCreating] = useState(false);
  // El último usuario creado, para el aviso de éxito; null si no hay nada que avisar.
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  return (
    <Stack gap="6">
      <HStack justify="space-between" wrap="wrap">
        <Heading size="xl">Usuarios</Heading>
        <Button
          colorPalette="brand"
          onClick={() => {
            setCreatedUser(null);
            setCreating(true);
          }}
        >
          Crear usuario nuevo
        </Button>
      </HStack>

      {createdUser && (
        <Text role="status" color="fg.success">
          Usuario creado: {createdUser.nombre} ({createdUser.email}). Entrégale su correo y la
          contraseña inicial.
        </Text>
      )}

      {creating && <CreateUserDialog onCreated={setCreatedUser} onClose={() => setCreating(false)} />}
    </Stack>
  );
}
