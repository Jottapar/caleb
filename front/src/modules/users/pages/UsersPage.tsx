import {
  Button,
  Center,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";

import { ChangePasswordDialog } from "../components/ChangePasswordDialog";
import { CreateUserDialog } from "../components/CreateUserDialog";
import { EditUserDrawer } from "../components/EditUserDrawer";
import { UserTable } from "../components/UserTable";
import { useUsers } from "../hooks/useUsers";

// Los usuarios de la empresa.
export function UsersPage() {
  const users = useUsers();
  const [creating, setCreating] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  // El aviso de éxito (usuario creado o editado); null si no hay nada que avisar.
  const [notice, setNotice] = useState<string | null>(null);
  // El id del usuario cuyo panel de editar está abierto; null si no hay panel. Se guarda el id y
  // no el usuario para que el panel vea siempre los datos más nuevos de la lista.
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const editingUser = users.data?.find((user) => user.id === editingUserId);

  return (
    <Stack gap="6">
      <HStack justify="space-between" wrap="wrap">
        <Heading size="xl">Usuarios</Heading>
        <HStack>
          <Button variant="outline" onClick={() => setChangingPassword(true)}>
            Cambiar mi contraseña
          </Button>
          <Button
            colorPalette="brand"
            onClick={() => {
              setNotice(null);
              setCreating(true);
            }}
          >
            Crear usuario nuevo
          </Button>
        </HStack>
      </HStack>

      {notice && (
        <Text role="status" color="fg.success">
          {notice}
        </Text>
      )}

      {users.isPending && (
        <Center py="8" role="status" aria-label="Cargando usuarios">
          <Spinner />
        </Center>
      )}

      {users.isError && (
        <Text color="fg.error">
          No pudimos cargar los usuarios. Intenta de nuevo.
        </Text>
      )}

      {/* No hay estado "vacío": la lista siempre trae por lo menos al Admin que la está viendo. */}
      {users.data && (
        <UserTable
          users={users.data}
          onEdit={(user) => {
            setNotice(null);
            setEditingUserId(user.id);
          }}
        />
      )}

      {editingUser && (
        <EditUserDrawer
          user={editingUser}
          onSaved={(user) => setNotice(`Usuario actualizado: ${user.nombre}.`)}
          onDeleted={(user) => setNotice(`Usuario eliminado: ${user.nombre}.`)}
          onClose={() => setEditingUserId(null)}
        />
      )}

      {changingPassword && (
        <ChangePasswordDialog
          onChanged={() => setNotice("Contraseña cambiada. Desde ahora entras con la nueva.")}
          onClose={() => setChangingPassword(false)}
        />
      )}

      {creating && (
        <CreateUserDialog
          onCreated={(user) =>
            setNotice(
              `Usuario creado: ${user.nombre} (${user.email}). Entrégale su correo y la contraseña inicial.`,
            )
          }
          onClose={() => setCreating(false)}
        />
      )}
    </Stack>
  );
}
