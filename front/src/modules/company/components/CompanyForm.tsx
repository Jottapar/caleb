import { Button, Field, Image, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

import { CompanyLogo } from "../../../shared/components/ui/CompanyLogo";
import { FORMATO_CORREO, SOLO_DIGITOS } from "../../../shared/lib/validators";
import type { Company } from "../types";
import { LogoCropDialog } from "./LogoCropDialog";

type FormErrors = {
  nit?: string;
  telefono?: string;
  email?: string;
};

// Solo revisa el formato de lo que ya esta escrito: NIT, telefono y correo son
// opcionales, asi que vacios no son un error. El nombre obligatorio lo dice el backend.
function validate(nit: string, telefono: string, email: string) {
  const errors: FormErrors = {};
  if (nit.trim() && !SOLO_DIGITOS.test(nit.trim())) {
    errors.nit = "El NIT solo puede tener números";
  }
  if (telefono.trim() && !SOLO_DIGITOS.test(telefono.trim())) {
    errors.telefono = "El teléfono solo puede tener números";
  }
  if (email.trim() && !FORMATO_CORREO.test(email.trim())) {
    errors.email = "Escribe un correo válido, por ejemplo nombre@dominio.com";
  }
  return errors;
}

// Las mismas reglas del backend (es quien manda), para avisar antes de enviar. Los pixeles solo
// los revisa el backend: leerlos aqui exigiria decodificar la imagen.
const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp"];

const PESO_MAXIMO_LOGO = 5 * 1024 * 1024; // bytes

// Solo el formato del archivo original: el peso se revisa después, sobre el logo ya recortado.
function validateLogo(file: File): string | null {
  if (!TIPOS_LOGO.includes(file.type)) {
    return "El logo debe ser una imagen PNG, JPG o WebP";
  }
  return null;
}

type Props = {
  initialValues: Company;
  // El logo que la empresa tiene hoy ('' si no tiene). Viene de /auth/me, no de /company.
  currentLogoVersion: string;
  // Se llama en cada intento de guardar, antes de validar: la pagina limpia con esto el
  // aviso (exito o error) del intento anterior.
  onSubmitAttempt: () => void;
  // `onSaved` hay que llamarlo cuando el guardado termino bien: reinicia lo que se hizo con el logo.
  onSubmit: (data: Company, logo: File | "remove" | null, onSaved: () => void) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function CompanyForm({ initialValues, currentLogoVersion, onSubmitAttempt, onSubmit, isSubmitting, errorMessage }: Props) {
  // El formulario se monta solo cuando los datos ya llegaron, por eso puede
  // arrancar el estado con ellos.
  const [nombre, setNombre] = useState(initialValues.nombre);
  const [nit, setNit] = useState(initialValues.documento_fiscal);
  const [direccion, setDireccion] = useState(initialValues.direccion);
  const [telefono, setTelefono] = useState(initialValues.telefono);
  const [email, setEmail] = useState(initialValues.email);
  const [errors, setErrors] = useState<FormErrors>({});
  // El logo elegido todavia no se sube: viaja al pulsar Guardar. `previewUrl` es una direccion
  // temporal del navegador para ver la imagen elegida; se crea al elegir el archivo (no en el
  // render) y se libera en el efecto de abajo.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  // La imagen original que el usuario está recortando y su dirección temporal; null si no hay
  // recorte abierto.
  const [cropTarget, setCropTarget] = useState<{ file: File; src: string } | null>(null);
  // "Quitar logo" solo lo marca; el borrado ocurre al pulsar Guardar, como el resto de los cambios.
  const [logoRemoved, setLogoRemoved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // La direccion temporal retiene la imagen en memoria hasta que se libera. Este efecto la libera
  // cada vez que cambia (se elige otro archivo o se limpia) y al salir de la pantalla.
  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  // Igual que con la vista previa: la dirección temporal de la imagen que se está recortando se
  // libera cuando el recorte se cierra y también si el usuario sale de la pantalla con él abierto.
  useEffect(() => {
    return () => {
      if (cropTarget) {
        URL.revokeObjectURL(cropTarget.src);
      }
    };
  }, [cropTarget]);

  // Tras guardar, el logo elegido o quitado ya es el actual: se limpia lo pendiente para que
  // el siguiente Guardar no lo vuelva a enviar (ni a borrar otro que se subio mientras tanto).
  function resetLogo() {
    setLogoFile(null);
    setLogoPreviewUrl(null);
    setLogoRemoved(false);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    const error = file ? validateLogo(file) : null;
    setLogoError(error);
    if (error) {
      // Un archivo rechazado no se queda elegido, y el campo se vacia para que no siga mostrando
      // el nombre de un archivo que no vale. Un logo que ya se habia recortado y confirmado no se
      // toca: solo lo reemplaza otro cuyo recorte se confirme.
      event.target.value = "";
      return;
    }
    // El archivo elegido todavía no es el logo: primero se recorta. Guardar nunca envía la imagen
    // original sin recortar, porque el logo pendiente solo cambia al confirmar el recorte.
    setCropTarget(file ? { file, src: URL.createObjectURL(file) } : null);
  }

  // Cierra el recorte. La dirección temporal de la imagen original la libera el efecto de abajo.
  function closeCrop() {
    setCropTarget(null);
  }

  // Igual que un archivo rechazado: no se queda elegido y el campo se vacía para que no siga
  // mostrando el nombre de un archivo que no se va a usar.
  function clearLogoInput() {
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  }

  function handleCropCancel() {
    closeCrop();
    clearLogoInput();
  }

  // Recibe el logo ya recortado. Cierra el recorte y, si el recorte no pesa de más, lo deja como
  // el logo pendiente, con su vista previa.
  function handleCropConfirm(cropped: File) {
    closeCrop();
    if (cropped.size > PESO_MAXIMO_LOGO) {
      setLogoError("El logo no puede pesar más de 5 MB");
      clearLogoInput();
      return;
    }
    setLogoFile(cropped);
    setLogoPreviewUrl(URL.createObjectURL(cropped));
    // El logo ya quedó elegido (recortado, con su vista previa). Se vacía el campo del archivo
    // original: si siguiera ahí, el navegador no avisaría al elegir ese mismo archivo otra vez
    // y el usuario no podría volver a recortarlo.
    clearLogoInput();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmitAttempt();
    // Se valida y se envia lo mismo: los textos sin espacios alrededor, que es como
    // los guarda el backend. Los campos se actualizan para que muestren lo guardado.
    const data: Company = {
      nombre: nombre.trim(),
      documento_fiscal: nit.trim(),
      direccion: direccion.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
    };
    setNombre(data.nombre);
    setNit(data.documento_fiscal);
    setDireccion(data.direccion);
    setTelefono(data.telefono);
    setEmail(data.email);

    const nuevosErrores = validate(data.documento_fiscal, data.telefono, data.email);
    setErrors(nuevosErrores);
    // Con algun error no se envia nada: el usuario corrige primero.
    if (Object.keys(nuevosErrores).length > 0) {
      return;
    }
    onSubmit(data, logoFile ?? (logoRemoved ? "remove" : null), resetLogo);
  }

  return (
    <Stack as="form" onSubmit={handleSubmit} gap="4" maxW="lg">
      <Field.Root>
        <Field.Label>Nombre</Field.Label>
        <Input value={nombre} onChange={(event) => setNombre(event.target.value)} />
      </Field.Root>

      <Field.Root invalid={Boolean(errors.nit)}>
        <Field.Label>NIT</Field.Label>
        <Input inputMode="numeric" value={nit} onChange={(event) => setNit(event.target.value)} />
        <Field.HelperText>Solo números, con el dígito de verificación al final.</Field.HelperText>
        <Field.ErrorText>{errors.nit}</Field.ErrorText>
      </Field.Root>

      <Field.Root>
        <Field.Label>Dirección</Field.Label>
        <Input value={direccion} onChange={(event) => setDireccion(event.target.value)} />
      </Field.Root>

      <Field.Root invalid={Boolean(errors.telefono)}>
        <Field.Label>Teléfono</Field.Label>
        <Input
          inputMode="numeric"
          value={telefono}
          onChange={(event) => setTelefono(event.target.value)}
        />
        <Field.ErrorText>{errors.telefono}</Field.ErrorText>
      </Field.Root>

      <Field.Root invalid={Boolean(errors.email)}>
        <Field.Label>Correo</Field.Label>
        <Input inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field.ErrorText>{errors.email}</Field.ErrorText>
      </Field.Root>

      <Field.Root invalid={Boolean(logoError)}>
        <Field.Label>Logo</Field.Label>
        <Input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleLogoChange}
        />
        <Field.HelperText>PNG, JPG o WebP, de hasta 5 MB.</Field.HelperText>
        <Field.ErrorText>{logoError}</Field.ErrorText>
      </Field.Root>
      {!logoPreviewUrl && currentLogoVersion && !logoRemoved && (
        <Stack alignSelf="start" gap="2">
          <CompanyLogo version={currentLogoVersion} maxH="32" />
          <Button type="button" variant="outline" size="sm" onClick={() => setLogoRemoved(true)}>
            Quitar logo
          </Button>
        </Stack>
      )}
      {currentLogoVersion && logoRemoved && !logoPreviewUrl && (
        <Stack alignSelf="start" gap="2">
          <Text color="fg.muted">El logo se quitará al guardar.</Text>
          <Button type="button" variant="outline" size="sm" onClick={() => setLogoRemoved(false)}>
            Deshacer
          </Button>
        </Stack>
      )}
      {logoPreviewUrl && (
        <Image src={logoPreviewUrl} alt="Vista previa del logo" maxH="32" alignSelf="start" />
      )}

      {errorMessage && <Text color="fg.error">{errorMessage}</Text>}

      <Button type="submit" colorPalette="brand" alignSelf="start" loading={isSubmitting}>
        Guardar
      </Button>

      {cropTarget && (
        <LogoCropDialog
          file={cropTarget.file}
          imageSrc={cropTarget.src}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </Stack>
  );
}
