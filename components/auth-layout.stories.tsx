import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthLayout } from "./auth-layout";

const meta = {
  title: "Components/AuthLayout",
  component: AuthLayout,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

const PlaceholderContent = () => (
  <Card className="w-full max-w-md">
    <CardHeader>
      <CardTitle>Authentication Card</CardTitle>
      <CardDescription>
        This is a placeholder card to demonstrate the layout.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The AuthLayout component provides a full-height centered layout with
        optional branding, perfect for login, signup, and password reset pages.
      </p>
    </CardContent>
  </Card>
);

export const Default: Story = {
  args: {
    children: <PlaceholderContent />,
  },
};

export const WithoutLogo: Story = {
  args: {
    children: <PlaceholderContent />,
    showLogo: false,
  },
};

export const GradientBackground: Story = {
  args: {
    children: <PlaceholderContent />,
    backgroundVariant: "gradient",
  },
};

export const PatternBackground: Story = {
  args: {
    children: <PlaceholderContent />,
    backgroundVariant: "pattern",
  },
};
