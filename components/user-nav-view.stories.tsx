import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { UserNavView } from "./user-nav-view";

const meta = {
  title: "Components/UserNavView",
  component: UserNavView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    email: "user@example.com",
    isAdmin: false,
    isPending: false,
    onSignOut: fn(),
    onNavigate: fn(),
  },
} satisfies Meta<typeof UserNavView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default user navigation view with regular user
 */
export const RegularUser: Story = {};

/**
 * Admin user with access to admin dashboard
 */
export const AdminUser: Story = {
  args: {
    email: "admin@example.com",
    isAdmin: true,
  },
};

/**
 * User currently signing out
 */
export const SigningOut: Story = {
  args: {
    isPending: true,
  },
};

/**
 * Admin user signing out
 */
export const AdminSigningOut: Story = {
  args: {
    email: "admin@example.com",
    isAdmin: true,
    isPending: true,
  },
};

/**
 * User with long email address
 */
export const LongEmail: Story = {
  args: {
    email: "verylongemailaddress@example.com",
  },
};

/**
 * User with short email (edge case for initials)
 */
export const ShortEmail: Story = {
  args: {
    email: "a@example.com",
  },
};
