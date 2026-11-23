import { Button, Field, Heading, HStack, Input, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import type { AccountType, Bank, ThirdParty, ThirdPartyCreate, ThirdPartyType } from "../types";

// Las mismas reglas que valida el backend (third_parties/service.py). El backend
// es la regla; esto es para avisar antes de enviar.
const FORMATO_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SOLO_DIGITOS = /^[0-9]+$/;
const MAX_DIGITOS_CUENTA = 20;

type FormErrors = {
  email?: string;
  telefono?: string;
  numeroCuenta?: string;
};

// Solo revisa el formato de lo que ya esta escrito. Si un campo obligatorio
// llega vacio, lo dice el backend ("El correo del tercero es obligatorio").
function validate(email: string, telefono: string, numeroCuenta: string, conCuenta: boolean) {
  const errors: FormErrors = {};
  if (email.trim() && !FORMATO_CORREO.test(email.trim())) {
    errors.email = "Escribe un correo válido, por ejemplo nombre@dominio.com";
  }
  if (telefono.trim() && !SOLO_DIGITOS.test(telefono.trim())) {
    errors.telefono = "El teléfono solo puede tener números";
  }
  if (conCuenta && numeroCuenta.trim()) {
    if (!SOLO_DIGITOS.test(numeroCuenta.trim())) {
      errors.numeroCuenta = "El número de cuenta solo puede tener números";
    } else if (numeroCuenta.trim().length > MAX_DIGITOS_CUENTA) {
      errors.numeroCuenta = `El número de cuenta no puede tener más de ${MAX_DIGITOS_CUENTA} dígitos`;
    }
  }
  return errors;
}

type Props = {
  banks: Bank[];
  banksError: boolean;
  initialValues?: ThirdParty;
  // El tipo no se pregunta: lo pone quien abre el formulario (la pantalla de Clientes o la de
  // Proveedores, o el recibo, que siempre crea un cliente). Un tercero no cambia de tipo.
  tipo: ThirdPartyType;
  onSubmit: (data: ThirdPartyCreate) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function ThirdPartyForm({
  banks,
  banksError,
  initialValues,
  tipo,
  onSubmit,
  onCancel,
  isSubmitting,
  errorMessage,
}: Props) {
  const cuentaInicial = initialValues?.cuenta_bancaria;
  const [nombre, setNombre] = useState(initialValues?.nombre ?? "");
  const [documento, setDocumento] = useState(initialValues?.documento ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [telefono, setTelefono] = useState(initialValues?.telefono ?? "");
  const [direccion, setDireccion] = useState(initialValues?.direccion ?? "");
  // "" en el select significa "sin cuenta bancaria"
  const [bancoId, setBancoId] = useState(cuentaInicial ? String(cuentaInicial.banco_id) : "");
  const [tipoCuenta, setTipoCuenta] = useState<AccountType>(cuentaInicial?.tipo_cuenta ?? "ahorros");
  const [numeroCuenta, setNumeroCuenta] = useState(cuentaInicial?.numero_cuenta ?? "");
  const [errors, setErrors] = useState<FormErrors>({});

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nuevosErrores = validate(email, telefono, numeroCuenta, Boolean(bancoId));
    setErrors(nuevosErrores);
    // Con algun error no se envia nada: el usuario corrige primero.
    if (Object.keys(nuevosErrores).length > 0) {
      return;
    }
    onSubmit({
      tipo,
      nombre,
      documento,
      email,
      telefono,
      direccion,
      // Sin banco elegido no hay cuenta: se manda null aunque haya un numero escrito.
      cuenta_bancaria: bancoId
        ? { banco_id: Number(bancoId), tipo_cuenta: tipoCuenta, numero_cuenta: numeroCuenta }
        : null,
    });
  }

  return (
    <Stack as="form" onSubmit={handleSubmit} gap="4">
      <Field.Root>
        <Field.Label>Nombre</Field.Label>
        <Input value={nombre} onChange={(event) => setNombre(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Documento</Field.Label>
        <Input value={documento} onChange={(event) => setDocumento(event.target.value)} />
      </Field.Root>

      <Field.Root invalid={Boolean(errors.email)}>
        <Field.Label>Correo</Field.Label>
        <Input inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field.ErrorText>{errors.email}</Field.ErrorText>
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

      <Field.Root>
        <Field.Label>Dirección</Field.Label>
        <Input value={direccion} onChange={(event) => setDireccion(event.target.value)} />
      </Field.Root>

      <Heading size="sm">Datos bancarios (opcional)</Heading>

      <Field.Root>
        <Field.Label>Banco</Field.Label>
        <NativeSelect.Root disabled={banksError}>
          <NativeSelect.Field value={bancoId} onChange={(event) => setBancoId(event.target.value)}>
            <option value="">Sin cuenta bancaria</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.nombre}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
        {banksError && (
          <Field.HelperText color="fg.error">
            No pudimos cargar la lista de bancos. Intenta de nuevo más tarde.
          </Field.HelperText>
        )}
      </Field.Root>

      {bancoId && (
        <>
          <Field.Root>
            <Field.Label>Tipo de cuenta</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={tipoCuenta}
                onChange={(event) => setTipoCuenta(event.target.value as AccountType)}
              >
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </NativeSelect.Field>
            </NativeSelect.Root>
          </Field.Root>

          <Field.Root invalid={Boolean(errors.numeroCuenta)}>
            <Field.Label>Número de cuenta</Field.Label>
            <Input
              inputMode="numeric"
              maxLength={MAX_DIGITOS_CUENTA}
              value={numeroCuenta}
              onChange={(event) => setNumeroCuenta(event.target.value)}
            />
            <Field.HelperText>Solo números, máximo {MAX_DIGITOS_CUENTA}.</Field.HelperText>
            <Field.ErrorText>{errors.numeroCuenta}</Field.ErrorText>
          </Field.Root>
        </>
      )}

      {errorMessage && <Text color="fg.error">{errorMessage}</Text>}

      <HStack>
        <Button type="submit" colorPalette="brand" loading={isSubmitting}>
          Guardar
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cerrar
          </Button>
        )}
      </HStack>
    </Stack>
  );
}
