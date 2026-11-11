import { Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import { useLogout } from "../hooks/useLogout";

export function LogoutButton() {
  const navigate = useNavigate();
  const logout = useLogout();

  function handleClick() {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }

  return (
    // Se pinta en el encabezado oscuro de Layout: sin estos colores, el
    // "ghost" por defecto usaria texto oscuro sobre un fondo oscuro.
    <Button
      variant="ghost"
      color="white"
      _hover={{ bg: "whiteAlpha.200" }}
      loading={logout.isPending}
      onClick={handleClick}
    >
      Cerrar sesión
    </Button>
  );
}
