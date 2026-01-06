"use client";

import { useState } from "react";
import { CreateOrganizationDialogView } from "@/components/create-organization-dialog-view";
import { useCreateOrganization } from "@/hooks/use-create-organization";

interface CreateOrganizationDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateOrganizationDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
}: CreateOrganizationDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };

  const { name, setName, error, isLoading, handleSubmit, handleCancel } =
    useCreateOrganization({ onOpenChange: setOpen });

  return (
    <CreateOrganizationDialogView
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      name={name}
      onNameChange={setName}
      error={error}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );
}
