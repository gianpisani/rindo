import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type Snapshot<TData> = { previous?: TData };

export function optimistic<TData, TVariables>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  apply: (data: TData, variables: TVariables) => TData,
) {
  return {
    onMutate: async (variables: TVariables): Promise<Snapshot<TData>> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TData>(queryKey);
      if (previous !== undefined) queryClient.setQueryData<TData>(queryKey, apply(previous, variables));
      return { previous };
    },
    onError: (_error: unknown, _variables: TVariables, snapshot?: Snapshot<TData>) => {
      if (snapshot?.previous !== undefined) queryClient.setQueryData(queryKey, snapshot.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  };
}
