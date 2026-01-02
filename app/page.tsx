import {
  Building2,
  CheckCircle2,
  Database,
  Layers,
  Shield,
  Users,
} from "lucide-react";
import { LiveStats } from "@/components/live-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Building2,
    title: "Multi-Tenant Architecture",
    description:
      "Isolated data per tenant with shared infrastructure. Each organization gets their own workspace.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Invite team members, assign tasks, and track progress together within your tenant.",
  },
  {
    icon: Shield,
    title: "Secure Isolation",
    description:
      "Row-level security ensures tenants can only access their own data. No data leakage.",
  },
  {
    icon: Database,
    title: "Scalable Design",
    description:
      "Built to handle growth from a single user to thousands of organizations.",
  },
];

const techStack = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "PostgreSQL",
  "Tailwind CSS",
  "shadcn/ui",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-16 text-center">
        <Badge variant="secondary" className="mb-4">
          Coding Kata
        </Badge>
        <h1 className="mb-6 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
          Multi-Tenant Todo
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-zinc-600 dark:text-zinc-400">
          A hands-on exercise to learn multi-tenant architecture by building a
          todo application where each organization has isolated, secure access
          to their own tasks.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" className="gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Get Started
          </Button>
          <Button size="lg" variant="outline">
            View Documentation
          </Button>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="container mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {techStack.map((tech) => (
            <Badge key={tech} variant="outline" className="px-3 py-1 text-sm">
              {tech}
            </Badge>
          ))}
        </div>
      </section>

      {/* Live Stats - tRPC Proof of Concept */}
      <section className="container mx-auto px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <LiveStats />
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            What You&apos;ll Learn
          </h2>
          <p className="mx-auto max-w-xl text-zinc-600 dark:text-zinc-400">
            This kata covers essential patterns for building production-ready
            SaaS applications with proper tenant isolation.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-zinc-200 dark:border-zinc-800"
            >
              <CardHeader>
                <feature.icon className="mb-2 h-10 w-10 text-zinc-700 dark:text-zinc-300" />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Architecture Overview */}
      <section className="container mx-auto px-6 py-16">
        <Card className="border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-8 md:flex-row">
              <div className="flex-1">
                <h3 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  Architecture Pattern
                </h3>
                <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                  This kata implements the{" "}
                  <strong>shared database, shared schema</strong> multi-tenancy
                  pattern with row-level security. Each table includes a{" "}
                  <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
                    tenant_id
                  </code>{" "}
                  column that automatically filters data based on the
                  authenticated user&apos;s organization.
                </p>
                <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
                  <li className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-green-600" />
                    Single database for all tenants
                  </li>
                  <li className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-green-600" />
                    Row-level security policies
                  </li>
                  <li className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-green-600" />
                    Automatic tenant context injection
                  </li>
                </ul>
              </div>
              <div className="flex-shrink-0">
                <div className="rounded-lg border border-zinc-300 bg-white p-6 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950">
                  <div className="text-zinc-500">// Example schema</div>
                  <div className="text-blue-600 dark:text-blue-400">
                    CREATE TABLE
                  </div>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {" "}
                    todos (
                  </span>
                  <div className="ml-4 text-zinc-900 dark:text-zinc-100">
                    id{" "}
                    <span className="text-purple-600 dark:text-purple-400">
                      UUID
                    </span>
                    ,
                  </div>
                  <div className="ml-4 text-zinc-900 dark:text-zinc-100">
                    tenant_id{" "}
                    <span className="text-purple-600 dark:text-purple-400">
                      UUID
                    </span>
                    ,
                  </div>
                  <div className="ml-4 text-zinc-900 dark:text-zinc-100">
                    title{" "}
                    <span className="text-purple-600 dark:text-purple-400">
                      TEXT
                    </span>
                    ,
                  </div>
                  <div className="ml-4 text-zinc-900 dark:text-zinc-100">
                    completed{" "}
                    <span className="text-purple-600 dark:text-purple-400">
                      BOOLEAN
                    </span>
                  </div>
                  <span className="text-zinc-900 dark:text-zinc-100">);</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-500">
        <p>
          Built as a learning exercise for multi-tenant architecture patterns.
        </p>
      </footer>
    </div>
  );
}
