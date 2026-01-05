import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (!session.user.isAdmin) {
    redirect("/");
  }

  return <>{children}</>;
}
