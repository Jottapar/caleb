import { Button, Dialog, Field, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { isAxiosError } from "axios";
import { useState } from "react";

import { type NewPasswordErrors, validateNewPassword } from "../passwordRules";
import { useChangePassword } from "../hooks/useChangePassword";

const ERROR_GENERICO = "No se pudo cambiar la contraseña. Intenta de nuevo.";

type Props = {
  // Avisa que la contraseña se cambió (la página muestra el aviso).
  onChanged: () => void;
  onClose: () => void;
};

// La ventana para que un usuario cambie su propia contraseña.
export function ChangePasswordDialog({ onChanged, onClose }: Props) {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<NewPasswordErrors>({});

  // El backend responde los errores en español (contraseña actual incorrecta, nueva igual a la
  // actual): se muestran tal cual, debajo del formulario.
  const error = changePassword.error;
  const errorMessage = !changePassword.isError
    ? null
    : ((isAxiosError(error) ? error.response?.data?.message : null) ?? ERROR_GENERICO);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nuevosErrores = validateNewPassword(next, confirmation);
    setErrors(nuevosErrores);
    // Con algún error no se envía nada: el usuario corrige primero.
    if (Object.keys(nuevosErrores).length > 0) {
      return;
    }
    changePassword.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          onChanged();
          onClose();
        },
      },
    );
  }

  return (
    <Dialog.Root open onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Cambiar mi contraseña</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack asChild gap="4">
              <form noValidate onSubmit={handleSubmit}>
                <Field.Root required>
                  <Field.Label>Contraseña actual</Field.Label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={current}
                    onChange={(event) => setCurrent(event.target.value)}
                  />
                </Field.Root>
                <Field.Root invalid={Boolean(errors.next)} required>
                  <Field.Label>Contraseña nueva</Field.Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={next}
                    onChange={(event) => setNext(event.target.value)}
                  />
                  <Field.ErrorText>{errors.next}</Field.ErrorText>
                </Field.Root>
                <Field.Root invalid={Boolean(errors.confirmation)} required>
                  <Field.Label>Confirmar contraseña nueva</Field.Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                  <Field.ErrorText>{errors.confirmation}</Field.ErrorText>
                </Field.Root>
                {errorMessage && <Text color="fg.error">{errorMessage}</Text>}
                <HStack>
                  <Button type="submit" colorPalette="brand" loading={changePassword.isPending}>
                    Guardar
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                </HStack>
              </form>
            </Stack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
