import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { SocialAuthButtons } from "./social-auth-buttons";

const meta = {
  title: "Components/SocialAuthButtons",
  component: SocialAuthButtons,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onGoogleClick: fn(),
    onGitHubClick: fn(),
  },
} satisfies Meta<typeof SocialAuthButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    mode: "signin",
    isLoading: false,
  },
};

export const SignUpMode: Story = {
  args: {
    mode: "signup",
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    mode: "signin",
    isLoading: true,
  },
};

export const GoogleOnly: Story = {
  args: {
    mode: "signin",
    isLoading: false,
    onGitHubClick: undefined,
  },
};

export const GitHubOnly: Story = {
  args: {
    mode: "signin",
    isLoading: false,
    onGoogleClick: undefined,
  },
};
