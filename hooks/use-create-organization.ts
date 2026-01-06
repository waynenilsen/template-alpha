"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

export interface UseCreateOrganizationProps {
  onOpenChange: (open: boolean) => void;
}

export function useCreateOrganization({
  onOpenChange,
}: UseCreateOrganizationProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createOrgMutation = useMutation(
    trpc.organization.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.refresh();
        onOpenChange(false);
        setName("");
        setError(null);
      },
      onError: (error) => {
        setError(error.message);
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Organization name is required");
      return;
    }
    setError(null);
    createOrgMutation.mutate({ name: name.trim() });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return {
    name,
    setName,
    error,
    isLoading: createOrgMutation.isPending,
    handleSubmit,
    handleCancel,
  };
}
