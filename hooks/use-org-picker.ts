"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTRPC } from "@/trpc/client";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface UseOrgPickerProps {
  organizations: Organization[];
  currentOrgId: string | null;
}

export function useOrgPicker({
  organizations,
  currentOrgId,
}: UseOrgPickerProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);

  const currentOrg = organizations.find((org) => org.id === currentOrgId);
  const canManageOrg =
    currentOrg?.role === "owner" || currentOrg?.role === "admin";

  const switchOrgMutation = useMutation(
    trpc.auth.switchOrg.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.refresh();
      },
    }),
  );

  const handleSelectOrg = (orgId: string) => {
    if (orgId === currentOrgId) return;
    startTransition(() => {
      switchOrgMutation.mutate({ organizationId: orgId });
    });
    setOpen(false);
  };

  const handleOpenCreateDialog = () => {
    setOpen(false);
    setCreateOrgDialogOpen(true);
  };

  return {
    open,
    setOpen,
    createOrgDialogOpen,
    setCreateOrgDialogOpen,
    isPending,
    isSwitching: switchOrgMutation.isPending,
    currentOrg,
    canManageOrg,
    handleSelectOrg,
    handleOpenCreateDialog,
  };
}
