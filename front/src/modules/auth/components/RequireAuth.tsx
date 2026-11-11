import { Center, Spinner } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useCurrentUser } from "../hooks/useCurrentUser";

type Props = {
  children?: ReactNode;
};

export function RequireAuth({ children }: Props) {
  const { isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <Center minH="50vh">
        <Spinner />
      </Center>
    );
  }

  if (isError) {
    return <Navigate to="/login" replace />;
  }

  return children ?? <Outlet />;
}
