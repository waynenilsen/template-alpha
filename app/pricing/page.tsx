import { Check, X } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/actions";
import { prisma } from "@/lib/db";
import type { PlanLimit } from "@/lib/subscriptions/plans";
import { UpgradeButton } from "./upgrade-button";

export const metadata = {
  title: "Pricing - Multi-Tenant Todo",
  description: "Choose the plan that works for you",
};

export default async function PricingPage() {
  const session = await getCurrentSession();

  // Fetch plans from database
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  // Get current subscription if user is logged in and has an org
  let currentPlanSlug: string | null = null;
  if (session?.currentOrgId) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: session.currentOrgId },
      include: { plan: { select: { slug: true } } },
    });
    currentPlanSlug = subscription?.plan.slug ?? null;
  }

  // If no plans in database, show setup message
  if (plans.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
        <div className="container mx-auto px-6 py-20 text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pricing Plans
          </h1>
          <Card className="mx-auto max-w-md">
            <CardHeader>
              <CardTitle>Setup Required</CardTitle>
              <CardDescription>
                Pricing plans haven&apos;t been configured yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Run the following command to set up Stripe and sync plans:
              </p>
              <code className="mt-4 block rounded bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
                bun run stripe:sync
              </code>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
      {/* Header */}
      <section className="container mx-auto px-6 pt-20 pb-12 text-center">
        <Badge variant="secondary" className="mb-4">
          Simple Pricing
        </Badge>
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Choose your plan
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Start free and upgrade as you grow. All plans include core features.
          No hidden fees.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-6 pb-20">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {plans.map((plan) => {
            const limits = plan.limits as unknown as PlanLimit;
            const isCurrentPlan = plan.slug === currentPlanSlug;
            const isFree = plan.priceMonthly === 0;
            const monthlyPrice = plan.priceMonthly / 100;
            const yearlyPrice = plan.priceYearly
              ? plan.priceYearly / 100
              : null;
            const yearlySavings = yearlyPrice
              ? Math.round(
                  ((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) *
                    100,
                )
              : 0;

            // Determine if this plan is highlighted (middle plan)
            const isHighlighted = plan.sortOrder === 1;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isHighlighted
                    ? "border-2 border-zinc-900 dark:border-zinc-100"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-8 pt-6">
                  {isCurrentPlan && (
                    <Badge variant="outline" className="mb-2 w-fit">
                      Current Plan
                    </Badge>
                  )}
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-6">
                  {/* Price */}
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
                        {isFree ? "Free" : `$${monthlyPrice}`}
                      </span>
                      {!isFree && (
                        <span className="text-zinc-600 dark:text-zinc-400">
                          /month
                        </span>
                      )}
                    </div>
                    {yearlyPrice && yearlySavings > 0 && (
                      <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                        Save {yearlySavings}% with yearly billing ($
                        {yearlyPrice}/year)
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3">
                    <PlanFeature
                      included={true}
                      text={`${limits.maxTodos === -1 ? "Unlimited" : limits.maxTodos.toLocaleString()} todos`}
                    />
                    <PlanFeature
                      included={true}
                      text={`${limits.maxMembers === -1 ? "Unlimited" : limits.maxMembers} team members`}
                    />
                    <PlanFeature
                      included={true}
                      text={`${limits.maxOrganizations === -1 ? "Unlimited" : limits.maxOrganizations} organizations`}
                    />
                    <PlanFeature included={true} text="Email support" />
                    <PlanFeature
                      included={plan.sortOrder > 0}
                      text="API access"
                    />
                    <PlanFeature
                      included={plan.sortOrder > 1}
                      text="Priority support"
                    />
                  </ul>
                </CardContent>

                <CardFooter className="pt-6">
                  {isCurrentPlan ? (
                    <Button className="w-full" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : isFree ? (
                    <Button className="w-full" variant="outline" asChild>
                      <Link href={session ? "/" : "/sign-up"}>
                        {session ? "Downgrade" : "Get Started"}
                      </Link>
                    </Button>
                  ) : session?.currentOrgId ? (
                    <UpgradeButton
                      planSlug={plan.slug}
                      planName={plan.name}
                      isHighlighted={isHighlighted}
                    />
                  ) : (
                    <Button
                      className="w-full"
                      variant={isHighlighted ? "default" : "outline"}
                      asChild
                    >
                      <Link href="/sign-up">Sign up to upgrade</Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <FaqItem
              question="Can I change my plan later?"
              answer="Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference. When downgrading, your new plan takes effect at the next billing cycle."
            />
            <FaqItem
              question="What happens when I hit my todo limit?"
              answer="You won't be able to create new todos until you upgrade your plan or delete some existing todos. Your existing todos will remain accessible."
            />
            <FaqItem
              question="Do you offer refunds?"
              answer="We offer a 14-day money-back guarantee. If you're not satisfied, contact us for a full refund."
            />
            <FaqItem
              question="Can I cancel anytime?"
              answer="Absolutely. You can cancel your subscription at any time. You'll continue to have access until the end of your billing period."
            />
          </div>
        </div>
      </section>

      {/* Back to home link */}
      <section className="container mx-auto px-6 pb-12 text-center">
        <Button variant="ghost" asChild>
          <Link href="/">← Back to home</Link>
        </Button>
      </section>
    </div>
  );
}

function PlanFeature({ included, text }: { included: boolean; text: string }) {
  return (
    <li className="flex items-center gap-3">
      {included ? (
        <Check className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
      ) : (
        <X className="h-5 w-5 flex-shrink-0 text-zinc-300 dark:text-zinc-600" />
      )}
      <span
        className={
          included
            ? "text-zinc-700 dark:text-zinc-300"
            : "text-zinc-400 dark:text-zinc-600"
        }
      >
        {text}
      </span>
    </li>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
        {question}
      </h3>
      <p className="text-zinc-600 dark:text-zinc-400">{answer}</p>
    </div>
  );
}
