import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { SignUpForm } from "./sign-up-form";

const meta = {
  title: "Components/SignUpForm",
  component: SignUpForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onSubmit: fn(),
    onSignIn: fn(),
  },
} satisfies Meta<typeof SignUpForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    error: "An account with this email already exists.",
  },
};

export const WithoutSignIn: Story = {
  args: {
    onSignIn: undefined,
  },
};
