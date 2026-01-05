/**
 * Declarative subscription plans configuration
 *
 * This is the single source of truth for all subscription plans.
 * The bootstrap script reads this and syncs to Stripe + Database.
 *
 * IMPORTANT: Plan slugs are immutable identifiers used across:
 * - Stripe product metadata
 * - Database records
 * - Application code
 *
 * Never change a slug after it's been used in production.
 */

export interface PlanLimit {
  /** Maximum number of todos per organization. -1 = unlimited */
  maxTodos: number;
  /** Maximum number of members per organization. -1 = unlimited */
  maxMembers: number;
  /** Maximum number of organizations per user. -1 = unlimited */
  maxOrganizations: number;
}

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

export interface PlanDefinition {
  /** Unique identifier - used in Stripe metadata and DB. NEVER change after creation. */
  slug: string;
  /** Display name shown to users */
  name: string;
  /** Short description for pricing cards */
  description: string;
  /** Price in cents per month (0 = free) */
  priceMonthly: number;
  /** Price in cents per year (0 = free, null = no yearly option) */
  priceYearly: number | null;
  /** Plan limits */
  limits: PlanLimit;
  /** Features list for pricing page */
  features: PlanFeature[];
  /** Sort order for display (lower = first) */
  order: number;
  /** Whether this plan is currently available for new subscriptions */
  active: boolean;
  /** Whether this is the default plan for new organizations */
  isDefault: boolean;
  /** Highlight this plan on pricing page */
  highlighted: boolean;
}

/**
 * All available subscription plans
 *
 * Add new plans here. The bootstrap script will:
 * 1. Create/update Stripe products and prices
 * 2. Sync to the database Plan table
 *
 * Plans are matched by slug across all systems.
 */
export const PLANS: PlanDefinition[] = [
  {
    slug: "free",
    name: "Free",
    description: "Perfect for getting started",
    priceMonthly: 0,
    priceYearly: null,
    limits: {
      maxTodos: 10,
      maxMembers: 1,
      maxOrganizations: 1,
    },
    features: [
      { name: "Todos", included: true, limit: "10" },
      { name: "Team members", included: true, limit: "1" },
      { name: "Organizations", included: true, limit: "1" },
      { name: "Email support", included: true },
      { name: "API access", included: false },
      { name: "Priority support", included: false },
    ],
    order: 0,
    active: true,
    isDefault: true,
    highlighted: false,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "For professionals and small teams",
    priceMonthly: 1200, // $12/month
    priceYearly: 9600, // $96/year ($8/month)
    limits: {
      maxTodos: 1000,
      maxMembers: 5,
      maxOrganizations: 3,
    },
    features: [
      { name: "Todos", included: true, limit: "1,000" },
      { name: "Team members", included: true, limit: "5" },
      { name: "Organizations", included: true, limit: "3" },
      { name: "Email support", included: true },
      { name: "API access", included: true },
      { name: "Priority support", included: false },
    ],
    order: 1,
    active: true,
    isDefault: false,
    highlighted: true,
  },
  {
    slug: "team",
    name: "Team",
    description: "For growing teams and businesses",
    priceMonthly: 4900, // $49/month
    priceYearly: 39000, // $390/year (~$32.50/month)
    limits: {
      maxTodos: -1, // unlimited
      maxMembers: 25,
      maxOrganizations: 10,
    },
    features: [
      { name: "Todos", included: true, limit: "Unlimited" },
      { name: "Team members", included: true, limit: "25" },
      { name: "Organizations", included: true, limit: "10" },
      { name: "Email support", included: true },
      { name: "API access", included: true },
      { name: "Priority support", included: true },
    ],
    order: 2,
    active: true,
    isDefault: false,
    highlighted: false,
  },
];

/**
 * Get a plan by its slug
 */
export function getPlanBySlug(slug: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.slug === slug);
}

/**
 * Get the default plan (free tier)
 */
export function getDefaultPlan(): PlanDefinition {
  const defaultPlan = PLANS.find((p) => p.isDefault);
  if (!defaultPlan) {
    throw new Error("No default plan configured");
  }
  return defaultPlan;
}

/**
 * Get all active plans sorted by order
 */
export function getActivePlans(): PlanDefinition[] {
  return PLANS.filter((p) => p.active).sort((a, b) => a.order - b.order);
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Format limit for display
 */
export function formatLimit(value: number): string {
  if (value === -1) return "Unlimited";
  return value.toLocaleString();
}
