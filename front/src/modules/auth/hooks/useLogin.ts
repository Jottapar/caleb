import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { LoginRequest } from "../types";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => api.post("/auth/login", data),
    onSuccess: () => {
      // Despues de loguearse, "/auth/me" ya tiene una respuesta distinta
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
