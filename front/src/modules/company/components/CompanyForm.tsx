import { Button, Field, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import { FORMATO_CORREO, SOLO_DIGITOS } from "../../../shared/lib/validators";
import type { Company } from "../types";

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

type Props = {
  initialValues: Company;
  // Se llama en cada intento de guardar, antes de validar: la pagina limpia con esto el
  // aviso (exito o error) del intento anterior.
  onSubmitAttempt: () => void;
  onSubmit: (data: Company) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function CompanyForm({ initialValues, onSubmitAttempt, onSubmit, isSubmitting, errorMessage }: Props) {
  // El formulario se monta solo cuando los datos ya llegaron, por eso puede
  // arrancar el estado con ellos.
  const [nombre, setNombre] = useState(initialValues.nombre);
  const [nit, setNit] = useState(initialValues.documento_fiscal);
  const [direccion, setDireccion] = useState(initialValues.direccion);
  const [telefono, setTelefono] = useState(initialValues.telefono);
  const [email, setEmail] = useState(initialValues.email);
  const [errors, setErrors] = useState<FormErrors>({});

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
    onSubmit(data);
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

      {errorMessage && <Text color="fg.error">{errorMessage}</Text>}

      <Button type="submit" colorPalette="brand" alignSelf="start" loading={isSubmitting}>
        Guardar
      </Button>
    </Stack>
  );
}
