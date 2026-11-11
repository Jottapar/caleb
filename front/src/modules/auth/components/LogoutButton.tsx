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
    <Button variant="ghost" loading={logout.isPending} onClick={handleClick}>
      Cerrar sesión
    </Button>
  );
}
