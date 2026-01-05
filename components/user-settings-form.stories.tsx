import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { UserSettingsForm } from "./user-settings-form";

const meta = {
  title: "Components/UserSettingsForm",
  component: UserSettingsForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof UserSettingsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialName: "John Doe",
    email: "john@example.com",
  },
};

export const Empty: Story = {
  args: {
    initialName: "",
    email: "user@example.com",
  },
};

export const Loading: Story = {
  args: {
    initialName: "John Doe",
    email: "john@example.com",
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    initialName: "John Doe",
    email: "john@example.com",
    error: "Failed to update profile. Please try again.",
  },
};

export const WithSuccess: Story = {
  args: {
    initialName: "John Doe",
    email: "john@example.com",
    success: true,
  },
};

export const LongName: Story = {
  args: {
    initialName: "Alexander Benjamin Christopher Davidson",
    email: "alexander.benjamin.christopher.davidson@example.com",
  },
};
