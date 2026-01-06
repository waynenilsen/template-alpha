"use client";

import { Plus } from "lucide-react";
import { CreateOrganizationDialog } from "@/components/create-organization-dialog";
import { OrgPickerView } from "@/components/org-picker-view";
import { Button } from "@/components/ui/button";
import { useOrgPicker } from "@/hooks/use-org-picker";

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
  const {
    open,
    setOpen,
    createOrgDialogOpen,
    setCreateOrgDialogOpen,
    isPending,
    isSwitching,
    currentOrg,
    canManageOrg,
    handleSelectOrg,
    handleOpenCreateDialog,
  } = useOrgPicker({ organizations, currentOrgId });

  return (
    <>
      <OrgPickerView
        organizations={organizations}
        currentOrgId={currentOrgId}
        currentOrgName={currentOrg?.name}
        open={open}
        onOpenChange={setOpen}
        onSelectOrg={handleSelectOrg}
        onCreateClick={handleOpenCreateDialog}
        isPending={isPending || isSwitching}
        canManageOrg={canManageOrg}
        createOrgTrigger={
          <CreateOrganizationDialog
            trigger={
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Create Organization
              </Button>
            }
          />
        }
      />
      <CreateOrganizationDialog
        open={createOrgDialogOpen}
        onOpenChange={setCreateOrgDialogOpen}
      />
    </>
  );
}
