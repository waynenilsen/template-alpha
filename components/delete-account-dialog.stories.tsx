import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Button } from "@/components/ui/button";
import { DeleteAccountDialog } from "./delete-account-dialog";

const meta = {
  title: "Components/DeleteAccountDialog",
  component: DeleteAccountDialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onConfirm: fn(),
    onOpenChange: fn(),
  },
} satisfies Meta<typeof DeleteAccountDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    trigger: <Button variant="destructive">Delete Account</Button>,
  },
};

export const Open: Story = {
  args: {
    trigger: <Button variant="destructive">Delete Account</Button>,
    open: true,
  },
};

export const Loading: Story = {
  args: {
    trigger: <Button variant="destructive">Delete Account</Button>,
    open: true,
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    trigger: <Button variant="destructive">Delete Account</Button>,
    open: true,
    error: "Password is incorrect",
  },
};

export const Controlled: Story = {
  args: {
    trigger: <Button variant="destructive">Delete Account</Button>,
    open: false,
  },
};
