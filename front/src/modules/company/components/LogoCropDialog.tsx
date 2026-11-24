import { Box, Button, Dialog, HStack, Portal, Slider, Text } from "@chakra-ui/react";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { cropImage } from "../../../shared/lib/cropImage";

type Props = {
  // El archivo original que eligió el usuario: de él salen el nombre y el tipo del recorte.
  file: File;
  // Dirección temporal del navegador (blob:...) de ese mismo archivo, para mostrarlo.
  imageSrc: string;
  // Se llama con el archivo ya recortado cuando el usuario confirma.
  onConfirm: (cropped: File) => void;
  // Se llama cuando el usuario cancela: no hay recorte y no se elige ningún archivo.
  onCancel: () => void;
};

export function LogoCropDialog({ file, imageSrc, onConfirm, onCancel }: Props) {
  // El Cropper es "controlado": no guarda por sí mismo dónde está la imagen ni cuánto zoom
  // tiene, así que ese estado lo llevamos aquí. `crop` es el desplazamiento de la imagen
  // → { x: 0, y: 0 } es centrada; `zoom` → 1 es la imagen entera.
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // El área elegida, en píxeles de la imagen original. Es null hasta que el Cropper la calcula.
  const [area, setArea] = useState<Area | null>(null);

  // Texto de error si el recorte falla (por ejemplo una imagen dañada que el navegador no abre);
  // null si no hay error.
  const [error, setError] = useState<string | null>(null);
  // true mientras se dibuja el recorte: bloquea el botón para que un segundo clic no lance otro
  // recorte sobre una imagen que el primero ya va a liberar.
  const [isCropping, setIsCropping] = useState(false);

  async function handleConfirm() {
    if (!area) {
      return;
    }
    setError(null);
    setIsCropping(true);
    let cropped: File;
    try {
      cropped = await cropImage(imageSrc, area, file.name, file.type);
    } catch {
      // Solo aquí se desbloquea el botón: si el recorte sale bien, quien recibe el archivo cierra
      // el diálogo y no queda nada que desbloquear.
      setError("No se pudo recortar la imagen. Prueba con otra.");
      setIsCropping(false);
      return;
    }
    // Fuera del try: un fallo de quien recibe el archivo no es un fallo del recorte.
    onConfirm(cropped);
  }

  return (
    // Portal: el diálogo se pinta fuera del <form> de la empresa. Así, sus botones no pueden
    // enviar ese formulario por accidente.
    <Portal>
      <Dialog.Root open onOpenChange={(details) => !details.open && onCancel()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Recortar logo</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {/* El Cropper se estira para llenar a su contenedor: necesita uno con alto propio. */}
              <Box position="relative" h="72">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_percentages, pixels) => setArea(pixels)}
                />
              </Box>
              {/* Los dos signos solo rotulan los extremos del deslizador: no son botones. */}
              <HStack mt="3" gap="3">
                <Text aria-hidden>−</Text>
                <Slider.Root
                  flex="1"
                  colorPalette="brand"
                  min={1}
                  max={3}
                  step={0.1}
                  value={[zoom]}
                  onValueChange={(details) => setZoom(details.value[0])}
                  aria-label={["Zoom"]}
                >
                  <Slider.Control>
                    <Slider.Track>
                      <Slider.Range />
                    </Slider.Track>
                    <Slider.Thumb index={0}>
                      <Slider.HiddenInput />
                    </Slider.Thumb>
                  </Slider.Control>
                </Slider.Root>
                <Text aria-hidden>+</Text>
              </HStack>
              {/* Siempre visible: sin esto el usuario no sabe que puede arrastrar ni hacer zoom. */}
              <Text mt="3" color="fg.muted" fontSize="sm">
                Arrastra la imagen para moverla. Usa el deslizador o la rueda del ratón para acercar.
              </Text>
              {error && (
                <Text mt="2" color="fg.error">
                  {error}
                </Text>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              {/* Sin área todavía (el Cropper aún carga la imagen) no hay nada que recortar. */}
              <Button
                type="button"
                colorPalette="brand"
                disabled={!area}
                loading={isCropping}
                onClick={handleConfirm}
              >
                Recortar
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  );
}
