import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { caller } from "@/trpc/server";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const trpcCaller = await caller();

  try {
    const { session } = await trpcCaller.auth.me();
    if (!session.currentOrgId) {
      redirect("/");
    }
  } catch {
    redirect("/sign-in");
  }

  return <AppShell>{children}</AppShell>;
}
