import { redirect } from "next/navigation";
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

  return <>{children}</>;
}
