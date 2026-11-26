import { Button, Dialog, Drawer, HStack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { useCurrentUser } from "../../auth/hooks/useCurrentUser";
import { useDeleteUser } from "../hooks/useDeleteUser";
import { useUpdateUser } from "../hooks/useUpdateUser";
import type { User } from "../types";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { UserForm } from "./UserForm";

const ERROR_GENERICO = "No se pudo guardar el usuario. Intenta de nuevo.";
const ERROR_GENERICO_ELIMINAR = "No se pudo eliminar el usuario. Intenta de nuevo.";
const ERROR_GENERICO_ESTADO = "No se pudo cambiar el estado del usuario. Intenta de nuevo.";

type Props = {
  // El usuario que se edita, tal como está hoy en la lista: al activar o desactivar, la lista se
  // vuelve a pedir y el panel recibe el estado nuevo (el botón cambia solo).
  user: User;
  // Recibe el usuario ya guardado, para que la página avise que quedó listo.
  onSaved: (user: User) => void;
  // Avisa que el usuario se eliminó (la página muestra el aviso y el panel se cierra).
  onDeleted: (user: User) => void;
  // Avisa que el Admin le restableció la contraseña a este usuario.
  onPasswordReset: (user: User) => void;
  onClose: () => void;
};

// El panel lateral para editar un usuario de la empresa.
export function EditUserDrawer({ user, onSaved, onDeleted, onPasswordReset, onClose }: Props) {
  const updateUser = useUpdateUser();
  // Desactivar es otra petición, que se aplica al confirmar sin esperar a "Guardar".
  const toggleActive = useUpdateUser();
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const deleteUser = useDeleteUser();
  // Quién tiene la sesión: decide si se ofrece «Restablecer contraseña».
  const me = useCurrentUser();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // El backend responde los errores en español: se muestra tal cual. Un 409 es "el correo ya
  // existe" y va junto al campo del correo; cualquier otro error (por ejemplo, "la empresa debe
  // tener al menos un Admin activo") va debajo del formulario.
  const error = updateUser.error;
  const backendMessage = isAxiosError(error)
    ? (error.response?.data?.message ?? null)
    : null;
  const isEmailTaken = isAxiosError(error) && error.response?.status === 409;
  const emailError = isEmailTaken ? backendMessage : null;
  const errorMessage =
    !updateUser.isError || isEmailTaken
      ? null
      : (backendMessage ?? ERROR_GENERICO);

  // El error de activar o desactivar (por ejemplo, "la empresa debe tener al menos un Admin
  // activo") se muestra en la confirmación, que sigue abierta.
  const toggleError = toggleActive.error;
  const toggleMessage = !toggleActive.isError
    ? null
    : ((isAxiosError(toggleError) ? toggleError.response?.data?.message : null) ??
      ERROR_GENERICO_ESTADO);

  // El error de eliminar (por ejemplo, "tiene historial") se muestra en la confirmación.
  const deleteError = deleteUser.error;
  const deleteMessage = !deleteUser.isError
    ? null
    : ((isAxiosError(deleteError) ? deleteError.response?.data?.message : null) ??
      ERROR_GENERICO_ELIMINAR);

  return (
    <Drawer.Root
      placement="end"
      open
      onOpenChange={(details) => !details.open && onClose()}
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Editar usuario</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body>
            {/* El panel se cierra solo si el backend guardó: si falla, queda abierto con lo
                escrito para que el Admin corrija. */}
            <UserForm
              key={user.id}
              initialValues={user}
              onSubmit={({ nombre, email, rol }) =>
                updateUser.mutate(
                  { id: user.id, data: { nombre, email, rol } },
                  {
                    onSuccess: (saved) => {
                      onSaved(saved);
                      onClose();
                    },
                  },
                )
              }
              onCancel={onClose}
              isSubmitting={updateUser.isPending}
              emailError={emailError}
              onEmailEdit={updateUser.reset}
              errorMessage={errorMessage}
            />
            {/* Desactivar pide confirmación; activar no: es reversible y no quita nada. */}
            <Button
              mt="6"
              variant="outline"
              colorPalette={user.activo ? "red" : "brand"}
              loading={!user.activo && toggleActive.isPending}
              onClick={() =>
                user.activo
                  ? setConfirmingDeactivate(true)
                  : toggleActive.mutate({ id: user.id, data: { activo: true } })
              }
            >
              {user.activo ? "Desactivar usuario" : "Activar usuario"}
            </Button>
            {/* Eliminar es para limpiar un usuario creado por error: solo si ya está inactivo y no
                tiene historial. */}
            {me.data?.rol === "admin" && me.data.id !== user.id && (
              <Button
                mt="6"
                ml="3"
                variant="outline"
                onClick={() => setResettingPassword(true)}
              >
                Restablecer contraseña
              </Button>
            )}
            {!user.activo && !user.tiene_historial && (
              <Button
                mt="6"
                ml="3"
                variant="outline"
                colorPalette="red"
                onClick={() => setConfirmingDelete(true)}
              >
                Eliminar usuario
              </Button>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>

      {confirmingDeactivate && (
        <Dialog.Root
          role="alertdialog"
          open
          onOpenChange={(details) =>
            !details.open && setConfirmingDeactivate(false)
          }
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Desactivar a {user.nombre}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  ¿Desactivar a {user.nombre}? Ya no podrá entrar a Caleb.
                </Text>
                {toggleMessage && (
                  <Text color="fg.error" mt="2">
                    {toggleMessage}
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <HStack>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmingDeactivate(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    colorPalette="red"
                    loading={toggleActive.isPending}
                    onClick={() =>
                      toggleActive.mutate(
                        { id: user.id, data: { activo: false } },
                        { onSuccess: () => setConfirmingDeactivate(false) },
                      )
                    }
                  >
                    Desactivar
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      )}

      {resettingPassword && (
        <ResetPasswordDialog
          user={user}
          onReset={onPasswordReset}
          onClose={() => setResettingPassword(false)}
        />
      )}

      {confirmingDelete && (
        <Dialog.Root
          role="alertdialog"
          open
          onOpenChange={(details) => {
            if (!details.open) {
              setConfirmingDelete(false);
              deleteUser.reset();
            }
          }}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Eliminar a {user.nombre}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  ¿Eliminar a {user.nombre}? Se borra para siempre y su correo
                  queda libre.
                </Text>
                {deleteMessage && (
                  <Text color="fg.error" mt="2">
                    {deleteMessage}
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <HStack>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConfirmingDelete(false);
                      deleteUser.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    colorPalette="red"
                    loading={deleteUser.isPending}
                    onClick={() =>
                      deleteUser.mutate(user.id, {
                        onSuccess: () => {
                          onDeleted(user);
                          onClose();
                        },
                      })
                    }
                  >
                    Eliminar
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      )}
    </Drawer.Root>
  );
}
