import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import Link from "next/link";
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

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface OrgPickerViewProps {
  organizations: Organization[];
  currentOrgId: string | null;
  currentOrgName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectOrg: (orgId: string) => void;
  onCreateClick: () => void;
  isPending: boolean;
  canManageOrg: boolean;
  createOrgTrigger?: React.ReactNode;
}

export function OrgPickerView({
  organizations,
  currentOrgId,
  currentOrgName,
  open,
  onOpenChange,
  onSelectOrg,
  onCreateClick,
  isPending,
  canManageOrg,
  createOrgTrigger,
}: OrgPickerViewProps) {
  // If no organizations, show create button
  if (organizations.length === 0) {
    return createOrgTrigger ?? null;
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
          disabled={isPending}
        >
          <Building2 className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {currentOrgName ?? "Select organization"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search organization..." />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup heading="Organizations">
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  onSelect={() => onSelectOrg(org.id)}
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
            {canManageOrg && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem asChild>
                    <Link
                      href="/settings/organization"
                      className="flex cursor-pointer"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Organization Settings
                    </Link>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={onCreateClick}>
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
