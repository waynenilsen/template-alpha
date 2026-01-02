"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface OrgPickerProps {
  organizations: Organization[];
  currentOrgId: string | null;
}

export function OrgPicker({ organizations, currentOrgId }: OrgPickerProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const currentOrg = organizations.find((org) => org.id === currentOrgId);

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
  };

  if (organizations.length === 0) {
    return (
      <Button variant="outline" size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Create Organization
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-[200px] justify-between"
          disabled={isPending || switchOrgMutation.isPending}
        >
          <Building2 className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {currentOrg?.name ?? "Select organization"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search organization..." />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup heading="Organizations">
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  onSelect={() => handleSelectOrg(org.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentOrgId === org.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{org.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {org.role}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem disabled>
                <Plus className="mr-2 h-4 w-4" />
                Create Organization
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
