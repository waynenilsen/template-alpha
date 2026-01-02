import type { Meta, StoryObj } from "@storybook/react";
import SignInPage from "@/app/(auth)/sign-in/page";

const meta = {
  title: "Pages/SignIn",
  component: SignInPage,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SignInPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
