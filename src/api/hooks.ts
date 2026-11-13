import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { request } from "./client";
import { okSchema } from "./schemas";
export function useResource<T>(
  path: string,
  schema: z.ZodType<T>,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: [path],
    queryFn: () => request(path, schema),
  });
}
export function useAction() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body,
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => request(path, okSchema, method, body),
    onSuccess: () => cache.invalidateQueries(),
  });
}
