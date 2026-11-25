import { Table } from "@chakra-ui/react";

import type { User, UserRole } from "../types";

// Cómo se escribe cada rol en pantalla; en la base y la API siguen siendo minúsculas.
const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  usuario: "Usuario",
  contador: "Contador",
};

type Props = {
  users: User[];
};

// La lista de usuarios de la empresa. Solo pinta: no tiene botones por fila todavía
// (editar es la historia 16c; desactivar y activar, la 16g).
export function UserTable({ users }: Props) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Nombre</Table.ColumnHeader>
          <Table.ColumnHeader>Correo</Table.ColumnHeader>
          <Table.ColumnHeader>Rol</Table.ColumnHeader>
          <Table.ColumnHeader>Estado</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {users.map((user) => (
          <Table.Row key={user.id}>
            <Table.Cell>{user.nombre}</Table.Cell>
            <Table.Cell>{user.email}</Table.Cell>
            <Table.Cell>{ROLE_LABELS[user.rol]}</Table.Cell>
            <Table.Cell>{user.activo ? "Activo" : "Inactivo"}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
