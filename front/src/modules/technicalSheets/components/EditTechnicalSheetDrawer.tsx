import { Drawer } from "@chakra-ui/react";

import type { Supply, TechnicalSheet, TechnicalSheetCreate } from "../types";
import { TechnicalSheetForm } from "./TechnicalSheetForm";

type Props = {
  sheet: TechnicalSheet; // la ficha que se edita; sus datos precargan el formulario
  supplies: Supply[]; // solo productos activos marcados como insumo
  onSubmit: (data: TechnicalSheetCreate) => void;
  onClose: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function EditTechnicalSheetDrawer({
  sheet,
  supplies,
  onSubmit,
  onClose,
  isSubmitting,
  errorMessage,
}: Props) {
  return (
    <Drawer.Root
      placement="end"
      open
      size="md"
      onOpenChange={(details) => !details.open && onClose()}
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Editar ficha técnica {sheet.codigo}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body>
            {/* key: si se abre otra ficha, el formulario arranca de cero con sus datos */}
            <TechnicalSheetForm
              key={sheet.id}
              supplies={supplies}
              initialValues={sheet}
              onSubmit={onSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              submitLabel="Guardar"
            />
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
