import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/lib/api";
import type { ThirdParty, ThirdPartyCreate } from "../types";

export function useCreateThirdParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ThirdPartyCreate) =>
      api.post<ThirdParty>("/third-parties", data).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["third-parties"] });
    },
  });
}
