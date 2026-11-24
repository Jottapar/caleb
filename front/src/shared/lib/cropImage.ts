import type { Area } from "react-easy-crop";

// Lado máximo del recorte, en píxeles. Es el mismo tamaño en que el backend deja el logo, y
// a ese tamaño el archivo nunca se acerca al tope de 5 MB.
const LADO_MAXIMO = 512;

// Recibe el área elegida en el recorte (en píxeles de la imagen original, siempre cuadrada
// → { x: 120, y: 40, width: 800, height: 800 }) y devuelve el lado, en píxeles, que tendrá
// el archivo recortado: el mismo del área, pero sin pasar de 512. Una imagen pequeña no se agranda.
export function outputSide(area: Area): number {
  return Math.min(area.width, LADO_MAXIMO);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo abrir la imagen"));
    image.src = src;
  });
}

// Recibe la dirección temporal de la imagen original (blob:...), el área elegida (ver arriba), y
// el nombre y el tipo del archivo original (→ "logo.png", "image/png"). Dibuja solo esa área en
// un <canvas> cuadrado y devuelve un File nuevo con el recorte. El navegador no siempre sabe
// codificar el tipo pedido (WebP en algunos): el File queda con el tipo que de verdad salió.
export async function cropImage(
  imageSrc: string,
  area: Area,
  fileName: string,
  fileType: string,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const side = outputSide(area);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("El navegador no pudo preparar el recorte");
  }
  // Copia el área elegida de la imagen original (x, y, ancho, alto) y la dibuja ocupando todo
  // el lienzo (0, 0, lado, lado); si el área es más grande que el lado, la reduce.
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, side, side);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, fileType));
  if (!blob) {
    throw new Error("El navegador no pudo generar el recorte");
  }
  return new File([blob], fileName, { type: blob.type });
}
