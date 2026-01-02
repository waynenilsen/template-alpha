import { AuthLayout } from "@/components/auth-layout";

export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayout backgroundVariant="gradient">{children}</AuthLayout>;
}
