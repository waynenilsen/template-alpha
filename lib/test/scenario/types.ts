/**
 * Core types for the scenario-based test framework
 *
 * This file defines the type contracts. It can be ugly.
 * The tests that use it will be beautiful.
 */

import type {
  MemberRole,
  Organization,
  OrganizationMember,
  Session,
  User,
} from "../../generated/prisma/client";

// ============================================================================
// Player Definitions - The Characters in Our Story
// ============================================================================

/**
 * A persona is a template for creating players
 * Each test gets its own instance of each persona
 */
export interface PersonaDefinition {
  name: string;
  traits: {
    isAdmin?: boolean;
  };
}

/**
 * An organization template
 */
export interface OrgDefinition {
  name: string;
  slug: string;
}

// ============================================================================
// Live Instances - What Actually Exists in the Database
// ============================================================================

export interface LivePlayer {
  user: User;
  password: string;
}

export interface LiveOrg {
  organization: Organization;
}

export interface LiveMembership {
  membership: OrganizationMember;
  session: Session;
}

// ============================================================================
// The Actor - A Player Performing Actions
// ============================================================================

/**
 * Result of todo operations
 */
export interface TodoResult {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  organizationId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoWithCreator extends TodoResult {
  createdBy: {
    id: string;
    email: string;
  };
}

export interface TodoListResult {
  items: TodoWithCreator[];
  nextCursor?: string;
}

export interface TodoStatsResult {
  total: number;
  completed: number;
  pending: number;
  completionRate: number;
}

/**
 * Actions an actor can perform at an organization
 */
export interface ActorActions {
  // Todo operations
  createTodo(input: {
    title: string;
    description?: string;
  }): Promise<TodoResult>;
  getTodo(input: { id: string }): Promise<TodoWithCreator>;
  listTodos(input?: {
    completed?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<TodoListResult>;
  updateTodo(input: {
    id: string;
    title?: string;
    description?: string | null;
    completed?: boolean;
  }): Promise<TodoResult>;
  deleteTodo(input: { id: string }): Promise<{ success: boolean }>;
  toggleTodo(input: { id: string }): Promise<TodoResult>;
  getTodoStats(): Promise<TodoStatsResult>;
}

/**
 * An actor is a player who can perform actions
 */
export interface Actor extends ActorActions {
  /** The underlying player */
  readonly player: LivePlayer;
  /** The organization context */
  readonly org: LiveOrg;
  /** The membership and session */
  readonly context: LiveMembership;
  /** Role in the organization */
  readonly role: MemberRole;
}

// ============================================================================
// The Cast - All Players and Orgs Available in a Scenario
// ============================================================================

/**
 * Standard players available in every scenario
 */
export interface StandardPlayers {
  // Regular users
  alice: Player;
  bob: Player;
  charlie: Player;
  diana: Player;
  eve: Player;

  // System administrators
  sysadmin: Player;
}

/**
 * Standard organizations available in every scenario
 */
export interface StandardOrgs {
  acmeCorp: Org;
  globex: Org;
  initech: Org;
  umbrella: Org;
  wayneEnterprises: Org;
}

// ============================================================================
// The Player Interface - What Tests Actually Use
// ============================================================================

/**
 * A player that can join organizations and perform actions
 */
export interface Player {
  /** Player's name for debugging */
  readonly name: string;

  /** The underlying user (created lazily) */
  readonly user: Promise<User>;

  /**
   * Join an organization with a role and perform actions there
   *
   * @example
   * await alice.at(acmeCorp).createTodo({ title: "Buy milk" });
   */
  at(org: Org, role?: MemberRole): Actor;

  /**
   * Join as owner (convenience method)
   */
  owns(org: Org): Actor;

  /**
   * Join as admin (convenience method)
   */
  administers(org: Org): Actor;

  /**
   * Try to access an org without being a member (for testing access control)
   * This creates a session pointing to the org but without membership
   */
  sneaksInto(org: Org): Actor;
}

/**
 * An organization that players can join
 */
export interface Org {
  /** Organization's name for debugging */
  readonly name: string;

  /** The underlying organization (created lazily) */
  readonly organization: Promise<Organization>;
}

// ============================================================================
// Scenario Function Signature
// ============================================================================

export interface ScenarioContext extends StandardPlayers, StandardOrgs {
  /** Create a custom player on the fly */
  createPlayer(name: string, traits?: { isAdmin?: boolean }): Player;

  /** Create a custom organization on the fly */
  createOrg(name: string): Org;
}

export type ScenarioFn = (ctx: ScenarioContext) => Promise<void>;
