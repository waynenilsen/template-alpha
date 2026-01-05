import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  showLogo?: boolean;
  backgroundVariant?: "default" | "gradient" | "pattern";
}

export function AuthLayout({
  children,
  showLogo = true,
  backgroundVariant = "gradient",
}: AuthLayoutProps) {
  return (
    <div
      className={cn(
        "min-h-screen flex flex-col",
        backgroundVariant === "gradient" &&
          "bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black",
        backgroundVariant === "default" && "bg-zinc-50 dark:bg-zinc-950",
        backgroundVariant === "pattern" &&
          "bg-zinc-50 dark:bg-zinc-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(0,0,0,0))]",
      )}
    >
      {/* Logo area */}
      {showLogo && (
        <div className="pt-8 pb-4 flex justify-center">
          <Link href="/" className="flex items-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-zinc-900 dark:text-zinc-100" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Multi-Tenant Todo
            </h1>
          </Link>
        </div>
      )}

      {/* Main content area - centered */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        © {new Date().getFullYear()} Multi-Tenant Todo. All rights reserved.
      </footer>
    </div>
  );
}
