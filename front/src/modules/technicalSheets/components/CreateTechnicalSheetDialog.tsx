import { Dialog } from "@chakra-ui/react";

import type { Supply, TechnicalSheetCreate } from "../types";
import { TechnicalSheetForm } from "./TechnicalSheetForm";

type Props = {
  supplies: Supply[]; // solo productos activos marcados como insumo
  onSubmit: (data: TechnicalSheetCreate) => void;
  onClose: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function CreateTechnicalSheetDialog({
  supplies,
  onSubmit,
  onClose,
  isSubmitting,
  errorMessage,
}: Props) {
  return (
    <Dialog.Root
      open
      size="lg"
      onOpenChange={(details) => !details.open && onClose()}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Crear ficha técnica</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <TechnicalSheetForm
              supplies={supplies}
              onSubmit={onSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              submitLabel="Crear ficha técnica"
            />
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
