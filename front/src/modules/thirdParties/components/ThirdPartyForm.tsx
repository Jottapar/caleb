import { Button, Field, Heading, HStack, Input, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import type { AccountType, Bank, ThirdParty, ThirdPartyCreate, ThirdPartyType } from "../types";

type Props = {
  banks: Bank[];
  banksError: boolean;
  initialValues?: ThirdParty;
  onSubmit: (data: ThirdPartyCreate) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
};

export function ThirdPartyForm({
  banks,
  banksError,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  errorMessage,
}: Props) {
  const cuentaInicial = initialValues?.cuenta_bancaria;
  const [tipo, setTipo] = useState<ThirdPartyType>(initialValues?.tipo ?? "cliente");
  const [nombre, setNombre] = useState(initialValues?.nombre ?? "");
  const [documento, setDocumento] = useState(initialValues?.documento ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [telefono, setTelefono] = useState(initialValues?.telefono ?? "");
  const [direccion, setDireccion] = useState(initialValues?.direccion ?? "");
  // "" en el select significa "sin cuenta bancaria"
  const [bancoId, setBancoId] = useState(cuentaInicial ? String(cuentaInicial.banco_id) : "");
  const [tipoCuenta, setTipoCuenta] = useState<AccountType>(cuentaInicial?.tipo_cuenta ?? "ahorros");
  const [numeroCuenta, setNumeroCuenta] = useState(cuentaInicial?.numero_cuenta ?? "");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    if (!initialValues) {
      setNombre("");
      setDocumento("");
      setEmail("");
      setTelefono("");
      setDireccion("");
      setBancoId("");
      setTipoCuenta("ahorros");
      setNumeroCuenta("");
    }
  }

  return (
    <Stack as="form" onSubmit={handleSubmit} gap="4">
      <Field.Root required>
        <Field.Label>Tipo</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={tipo}
            onChange={(event) => setTipo(event.target.value as ThirdPartyType)}
          >
            <option value="cliente">Cliente</option>
            <option value="proveedor">Proveedor</option>
            <option value="ambos">Ambos</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>

      <Field.Root>
        <Field.Label>Nombre</Field.Label>
        <Input value={nombre} onChange={(event) => setNombre(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Documento</Field.Label>
        <Input value={documento} onChange={(event) => setDocumento(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Correo</Field.Label>
        <Input value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Teléfono</Field.Label>
        <Input value={telefono} onChange={(event) => setTelefono(event.target.value)} />
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

          <Field.Root>
            <Field.Label>Número de cuenta</Field.Label>
            <Input value={numeroCuenta} onChange={(event) => setNumeroCuenta(event.target.value)} />
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
