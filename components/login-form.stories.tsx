import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { LoginForm } from "./login-form";

const meta = {
  title: "Components/LoginForm",
  component: LoginForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onSubmit: fn(),
    onForgotPassword: fn(),
    onSignUp: fn(),
  },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutForgotPassword: Story = {
  args: {
    onForgotPassword: undefined,
  },
};

export const WithoutSignUp: Story = {
  args: {
    onSignUp: undefined,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    error: "Invalid email or password. Please try again.",
  },
};

export const Minimal: Story = {
  args: {
    onForgotPassword: undefined,
    onSignUp: undefined,
  },
};
