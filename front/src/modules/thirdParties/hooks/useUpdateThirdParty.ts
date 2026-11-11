import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { ThirdParty, ThirdPartyCreate } from "../types";

type UpdateVariables = {
  id: number;
  data: Partial<ThirdPartyCreate>;
};

export function useUpdateThirdParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateVariables) =>
      api.patch<ThirdParty>(`/third-parties/${id}`, data).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["third-parties"] });
    },
  });
}
