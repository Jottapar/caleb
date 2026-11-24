import { Image, type ImageProps } from "@chakra-ui/react";
import { useState } from "react";

type Props = Omit<ImageProps, "src" | "alt" | "onError"> & {
  // La version del logo que devuelve GET /auth/me (la ruta del archivo; cambia con cada logo nuevo).
  version: string;
};

/**
 * El logo de la empresa del usuario, tal como lo entrega la API.
 *
 * El bucket es privado: la imagen sale de GET /company/logo, que revisa la sesion (el navegador
 * manda la cookie solo, porque la API esta en el mismo origen). La version va en la URL para que,
 * al subir un logo nuevo, el navegador no muestre el viejo que tiene guardado en cache.
 *
 * Si la imagen no carga (sesion vencida, el almacen no responde), no se pinta nada en vez de
 * una imagen rota.
 */
export function CompanyLogo({ version, ...props }: Props) {
  // Se recuerda cual version fallo, no solo "fallo": con un logo nuevo la version cambia y se
  // vuelve a intentar sin necesidad de un efecto que reinicie el estado.
  const [failedVersion, setFailedVersion] = useState<string | null>(null);

  if (failedVersion === version) {
    return null;
  }

  return (
    <Image
      src={`${import.meta.env.VITE_API_URL}/company/logo?v=${encodeURIComponent(version)}`}
      alt="Logo de la empresa"
      onError={() => setFailedVersion(version)}
      {...props}
    />
  );
}
