import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useAppShell() {
  const trpc = useTRPC();
  const meQuery = useQuery(trpc.auth.me.queryOptions());

  const user = meQuery.data?.user;
  const session = meQuery.data?.session;
  const organizations = meQuery.data?.organizations ?? [];
  const isLoading = meQuery.isLoading;

  return {
    user,
    session,
    organizations,
    isLoading,
    currentOrgId: session?.currentOrgId ?? null,
  };
}
