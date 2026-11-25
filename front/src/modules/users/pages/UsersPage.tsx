import { Button, Center, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import { CreateUserDialog } from "../components/CreateUserDialog";
import { UserTable } from "../components/UserTable";
import { useUsers } from "../hooks/useUsers";
import type { User } from "../types";

// Los usuarios de la empresa.
export function UsersPage() {
  const users = useUsers();
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

      {users.isPending && (
        <Center py="8" role="status" aria-label="Cargando usuarios">
          <Spinner />
        </Center>
      )}

      {users.isError && <Text color="fg.error">No pudimos cargar los usuarios. Intenta de nuevo.</Text>}

      {/* No hay estado "vacío": la lista siempre trae por lo menos al Admin que la está viendo. */}
      {users.data && <UserTable users={users.data} />}

      {creating && <CreateUserDialog onCreated={setCreatedUser} onClose={() => setCreating(false)} />}
    </Stack>
  );
}
