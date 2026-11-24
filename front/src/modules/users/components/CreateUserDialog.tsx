import { Dialog } from "@chakra-ui/react";
import { isAxiosError } from "axios";

import { useCreateUser } from "../hooks/useCreateUser";
import type { User } from "../types";
import { UserForm } from "./UserForm";

const ERROR_GENERICO = "No se pudo crear el usuario. Intenta de nuevo.";

type Props = {
  // Recibe el usuario recién creado, para que la página avise que quedó listo.
  onCreated: (user: User) => void;
  onClose: () => void;
};

// La ventana de crear un usuario de la empresa.
export function CreateUserDialog({ onCreated, onClose }: Props) {
  const createUser = useCreateUser();

  // El backend responde los errores en español: se muestra tal cual. Un 409 es "el correo ya
  // existe" y va junto al campo del correo; cualquier otro error va debajo del formulario.
  const error = createUser.error;
  const backendMessage = isAxiosError(error) ? (error.response?.data?.message ?? null) : null;
  const isEmailTaken = isAxiosError(error) && error.response?.status === 409;
  const emailError = isEmailTaken ? backendMessage : null;
  const errorMessage = !createUser.isError || isEmailTaken ? null : (backendMessage ?? ERROR_GENERICO);

  return (
    <Dialog.Root open onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Crear usuario nuevo</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            {/* La ventana se cierra solo si el backend guardó: si falla, queda abierta con los
                datos escritos y el error a la vista para que el Admin corrija. */}
            <UserForm
              onSubmit={(data) =>
                createUser.mutate(data, {
                  onSuccess: (user) => {
                    onCreated(user);
                    onClose();
                  },
                })
              }
              onCancel={onClose}
              isSubmitting={createUser.isPending}
              emailError={emailError}
              onEmailEdit={createUser.reset}
              errorMessage={errorMessage}
            />
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
