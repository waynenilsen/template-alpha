import type { Meta, StoryObj } from "@storybook/react";
import { PasswordStrengthIndicator } from "./password-strength-indicator";

const meta = {
  title: "Components/PasswordStrengthIndicator",
  component: PasswordStrengthIndicator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PasswordStrengthIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    password: "",
  },
};

export const Weak: Story = {
  args: {
    password: "abc",
  },
};

export const Fair: Story = {
  args: {
    password: "password",
  },
};

export const Good: Story = {
  args: {
    password: "Password1",
  },
};

export const Strong: Story = {
  args: {
    password: "Password1!",
  },
};
