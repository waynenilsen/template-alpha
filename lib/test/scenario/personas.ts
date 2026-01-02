/**
 * Well-known personas for our test scenarios
 *
 * Each persona is a template. In each test, a fresh instance is created.
 * Alice in test A is completely separate from Alice in test B.
 */

import type { OrgDefinition, PersonaDefinition } from "./types";

// ============================================================================
// The Players - Our Cast of Characters
// ============================================================================

export const PERSONAS = {
  // Regular users - the everyday protagonists
  alice: {
    name: "Alice",
    traits: { isAdmin: false },
  },
  bob: {
    name: "Bob",
    traits: { isAdmin: false },
  },
  charlie: {
    name: "Charlie",
    traits: { isAdmin: false },
  },
  diana: {
    name: "Diana",
    traits: { isAdmin: false },
  },
  eve: {
    name: "Eve",
    traits: { isAdmin: false },
  },

  // System administrators - the ones with the keys
  sysadmin: {
    name: "SysAdmin",
    traits: { isAdmin: true },
  },
} as const satisfies Record<string, PersonaDefinition>;

// ============================================================================
// The Organizations - Where Our Story Unfolds
// ============================================================================

export const ORGS = {
  // The classics
  acmeCorp: {
    name: "Acme Corporation",
    slug: "acme-corp",
  },
  globex: {
    name: "Globex Corporation",
    slug: "globex",
  },
  initech: {
    name: "Initech",
    slug: "initech",
  },

  // The villains (for dramatic effect)
  umbrella: {
    name: "Umbrella Corporation",
    slug: "umbrella",
  },

  // The heroes
  wayneEnterprises: {
    name: "Wayne Enterprises",
    slug: "wayne-enterprises",
  },
} as const satisfies Record<string, OrgDefinition>;

export type PersonaName = keyof typeof PERSONAS;
export type OrgName = keyof typeof ORGS;
