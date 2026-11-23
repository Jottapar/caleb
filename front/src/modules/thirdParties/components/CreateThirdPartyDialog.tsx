import { Dialog } from "@chakra-ui/react";
import { isAxiosError } from "axios";

import { useBanks } from "../hooks/useBanks";
import { useCreateThirdParty } from "../hooks/useCreateThirdParty";
import type { ThirdParty, ThirdPartyType } from "../types";
import { ThirdPartyForm } from "./ThirdPartyForm";

const ERROR_GENERICO = "No se pudo guardar el tercero. Intenta de nuevo.";

type Props = {
  title: string;
  // El tipo con el que se crea: lo decide quien abre la ventana, no el usuario.
  tipo: ThirdPartyType;
  // Recibe el tercero recién creado (ya con su id), para quien necesite elegirlo.
  onCreated?: (thirdParty: ThirdParty) => void;
  onClose: () => void;
};

// La ventana de crear un cliente o proveedor. La usan las pantallas de Clientes, de Proveedores
// y la de Recibos, así el formulario y sus reglas viven en un solo lugar.
export function CreateThirdPartyDialog({
  title,
  tipo,
  onCreated,
  onClose,
}: Props) {
  const banks = useBanks();
  const createThirdParty = useCreateThirdParty();

  const errorMessage = !createThirdParty.isError
    ? null
    : isAxiosError(createThirdParty.error) &&
        createThirdParty.error.response?.data?.message
      ? createThirdParty.error.response.data.message
      : ERROR_GENERICO;

  return (
    <Dialog.Root open onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            {/* La ventana se cierra solo si el backend guardó: si falla, queda abierta con los
                datos escritos y el error a la vista para que el usuario corrija. */}
            <ThirdPartyForm
              banks={banks.data ?? []}
              banksError={banks.isError}
              tipo={tipo}
              onSubmit={(data) =>
                createThirdParty.mutate(data, {
                  onSuccess: (thirdParty) => {
                    onCreated?.(thirdParty);
                    onClose();
                  },
                })
              }
              onCancel={onClose}
              isSubmitting={createThirdParty.isPending}
              errorMessage={errorMessage}
            />
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
