import {
  Button,
  Field,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";

import { FORMATO_CORREO } from "../../../shared/lib/validators";
import { MIN_LARGO_PASSWORD, passwordLengthError } from "../passwordRules";
import type { User, UserCreate, UserRole } from "../types";

// Las mismas reglas del backend (es quien manda), para avisar antes de enviar.
const MAX_LARGO = 150; // nombre y correo

const ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "usuario", label: "Usuario" },
  { value: "contador", label: "Contador" },
];

type FormErrors = {
  nombre?: string;
  email?: string;
  password?: string;
};

// `requirePassword` es false al editar: ahí el campo ni se muestra.
function validate(
  nombre: string,
  email: string,
  password: string,
  requirePassword: boolean,
) {
  const errors: FormErrors = {};
  if (!nombre.trim()) {
    errors.nombre = "El nombre es obligatorio";
  }
  if (!email.trim()) {
    errors.email = "El correo es obligatorio";
  } else if (!FORMATO_CORREO.test(email.trim())) {
    errors.email = "Escribe un correo válido, por ejemplo nombre@dominio.com";
  }
  const passwordError = requirePassword ? passwordLengthError(password) : undefined;
  // Solo se agrega si hay error: con la clave presente (aunque vacía), el formulario no se envía.
  if (passwordError) {
    errors.password = passwordError;
  }
  return errors;
}

type Props = {
  // El usuario que se edita. Sin él, el formulario es el de crear: vacío y con contraseña inicial.
  initialValues?: User;
  // Al editar, `password` llega vacío y quien recibe los datos lo ignora.
  onSubmit: (data: UserCreate) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  // El error del backend que pertenece al campo del correo (el correo ya existe).
  emailError: string | null;
  // Se llama cuando el Admin edita el correo teniendo un `emailError` a la vista: quien lo guarda
  // lo limpia, para que el campo no siga en rojo con un correo que ya es otro.
  onEmailEdit: () => void;
  // Cualquier otro error del backend, que no es de un campo en particular.
  errorMessage: string | null;
};

export function UserForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  emailError,
  onEmailEdit,
  errorMessage,
}: Props) {
  const [nombre, setNombre] = useState(initialValues?.nombre ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  // Arranca en el rol de menos responsabilidad: quien crea un Admin lo elige a propósito.
  const [rol, setRol] = useState<UserRole>(initialValues?.rol ?? "usuario");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nuevosErrores = validate(nombre, email, password, !initialValues);
    setErrors(nuevosErrores);
    // Con algún error no se envía nada: el usuario corrige primero.
    if (Object.keys(nuevosErrores).length > 0) {
      return;
    }
    onSubmit({ nombre, email, rol, password });
  }

  const emailMessage = errors.email ?? emailError ?? undefined;

  return (
    // `noValidate`: los campos son `required` (para el asterisco), pero sin esto el navegador frena
    // el envío con su propio globo, en su idioma, y nunca llega a salir el mensaje de aquí abajo.
    <Stack asChild gap="4">
      <form noValidate onSubmit={handleSubmit}>
        <Field.Root invalid={Boolean(errors.nombre)} required>
          <Field.Label>Nombre</Field.Label>
          <Input
            maxLength={MAX_LARGO}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
          />
          <Field.ErrorText>{errors.nombre}</Field.ErrorText>
        </Field.Root>

        <Field.Root invalid={Boolean(emailMessage)} required>
          <Field.Label>Correo</Field.Label>
          <Input
            inputMode="email"
            maxLength={MAX_LARGO}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              // Solo si hay un error del backend que limpiar: llamarlo siempre reiniciaría la
              // petición en curso si el Admin escribe mientras se guarda.
              if (emailError) {
                onEmailEdit();
              }
            }}
          />
          <Field.ErrorText>{emailMessage}</Field.ErrorText>
        </Field.Root>

        <Field.Root>
          <Field.Label>Rol</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={rol}
              onChange={(event) => setRol(event.target.value as UserRole)}
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Field.Root>

        {/* La contraseña solo se pide al crear: editar no la toca (cambiarla es la historia 16f). */}
        {!initialValues && (
          <Field.Root invalid={Boolean(errors.password)} required>
            <Field.Label>Contraseña inicial</Field.Label>
            {/* "new-password" para que el navegador no rellene aquí la contraseña del Admin. */}
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Field.HelperText>
              Mínimo {MIN_LARGO_PASSWORD} caracteres. Se la entregas tú a la
              persona; luego ella la puede cambiar.
            </Field.HelperText>
            <Field.ErrorText>{errors.password}</Field.ErrorText>
          </Field.Root>
        )}

        {errorMessage && <Text color="fg.error">{errorMessage}</Text>}

        <HStack>
          <Button type="submit" colorPalette="brand" loading={isSubmitting}>
            Guardar
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </HStack>
      </form>
    </Stack>
  );
}
