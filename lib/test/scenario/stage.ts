/**
 * The Stage - Where Our Scenarios Come to Life
 *
 * This file manages the lifecycle of players and organizations.
 * It handles lazy creation, caching, and cleanup.
 *
 * This code can be ugly. The tests will be beautiful.
 */

import { createTestTRPCContext } from "../../../trpc/init";
import { appRouter } from "../../../trpc/router";
import type {
  MemberRole,
  Organization,
  Session,
  User,
} from "../../generated/prisma/client";
import { createTestContext, type TestContext } from "../harness";
import type {
  Actor,
  ActorActions,
  LiveMembership,
  LiveOrg,
  LivePlayer,
  Org,
  OrgDefinition,
  PersonaDefinition,
  Player,
} from "./types";

// ============================================================================
// The Stage Class
// ============================================================================

export class Stage {
  private readonly ctx: TestContext;
  private readonly players = new Map<string, LivePlayer>();
  private readonly orgs = new Map<string, LiveOrg>();
  private readonly memberships = new Map<string, LiveMembership>();
  private readonly sneakySessions = new Map<string, Session>();

  constructor() {
    this.ctx = createTestContext();
  }

  /* c8 ignore start */
  get testContext(): TestContext {
    return this.ctx;
  }
  /* c8 ignore stop */

  // ==========================================================================
  // Player Management
  // ==========================================================================

  /**
   * Get or create a player from a persona definition
   */
  async getOrCreatePlayer(
    key: string,
    persona: PersonaDefinition,
  ): Promise<LivePlayer> {
    const existing = this.players.get(key);
    if (existing) return existing;

    const password = `${persona.name.toLowerCase()}-secret-123`;
    const user = await this.ctx.createUser({
      email: `${this.ctx.prefix}${persona.name.toLowerCase()}@example.com`,
      password,
      isAdmin: persona.traits.isAdmin ?? false,
    });

    const player: LivePlayer = { user, password };
    this.players.set(key, player);
    return player;
  }

  // ==========================================================================
  // Organization Management
  // ==========================================================================

  /**
   * Get or create an organization from a definition
   */
  async getOrCreateOrg(key: string, def: OrgDefinition): Promise<LiveOrg> {
    const existing = this.orgs.get(key);
    if (existing) return existing;

    const organization = await this.ctx.createOrganization({
      name: def.name,
      slug: `${this.ctx.prefix}${def.slug}`,
    });

    const org: LiveOrg = { organization };
    this.orgs.set(key, org);
    return org;
  }

  // ==========================================================================
  // Membership Management
  // ==========================================================================

  /**
   * Get or create a membership (player joining an org)
   */
  async getOrCreateMembership(
    player: LivePlayer,
    org: LiveOrg,
    role: MemberRole,
  ): Promise<LiveMembership> {
    const key = `${player.user.id}:${org.organization.id}:${role}`;
    const existing = this.memberships.get(key);
    if (existing) return existing;

    // Check if any membership exists for this user+org
    const existingMembershipKey = Array.from(this.memberships.keys()).find(
      (k) => k.startsWith(`${player.user.id}:${org.organization.id}:`),
    );

    let membership: LiveMembership;

    if (existingMembershipKey) {
      // Membership exists - reuse it but create new session
      const existingMembership = this.memberships.get(existingMembershipKey);
      if (!existingMembership) {
        throw new Error("Membership key exists but membership not found");
      }
      const session = await this.ctx.createSession({
        userId: player.user.id,
        currentOrgId: org.organization.id,
      });
      membership = {
        membership: existingMembership.membership,
        session,
      };
    } else {
      // Create new membership
      const membershipRecord = await this.ctx.createMembership({
        userId: player.user.id,
        organizationId: org.organization.id,
        role,
      });

      const session = await this.ctx.createSession({
        userId: player.user.id,
        currentOrgId: org.organization.id,
      });

      membership = {
        membership: membershipRecord,
        session,
      };
    }

    this.memberships.set(key, membership);
    return membership;
  }

  /**
   * Create a sneaky session (no membership, for testing access control)
   */
  async getSneakySession(player: LivePlayer, org: LiveOrg): Promise<Session> {
    const key = `sneaky:${player.user.id}:${org.organization.id}`;
    const existing = this.sneakySessions.get(key);
    if (existing) return existing;

    const session = await this.ctx.createSession({
      userId: player.user.id,
      currentOrgId: org.organization.id,
    });

    this.sneakySessions.set(key, session);
    return session;
  }

  // ==========================================================================
  // Actor Creation
  // ==========================================================================

  /**
   * Create an actor (player + org context + actions)
   */
  createActor(
    player: LivePlayer,
    org: LiveOrg,
    context: LiveMembership,
  ): Actor {
    const actions = this.createActorActions(player, org, context.session);

    return {
      player,
      org,
      context,
      role: context.membership.role,
      ...actions,
    };
  }

  /**
   * Create a sneaky actor (player trying to access org without membership)
   */
  createSneakyActor(player: LivePlayer, org: LiveOrg, session: Session): Actor {
    const actions = this.createActorActions(player, org, session);

    // Fake membership for type compatibility - sneaky!
    const fakeMembership: LiveMembership = {
      membership: {
        id: "sneaky",
        userId: player.user.id,
        organizationId: org.organization.id,
        role: "member",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session,
    };

    return {
      player,
      org,
      context: fakeMembership,
      role: "member",
      ...actions,
    };
  }

  /**
   * Create the actions object for an actor
   */
  private createActorActions(
    player: LivePlayer,
    _org: LiveOrg,
    session: Session,
  ): ActorActions {
    const stage = this;

    const createCaller = () => {
      const trpcCtx = createTestTRPCContext({
        prisma: stage.ctx.prisma,
        sessionId: session.id,
        session,
        user: {
          id: player.user.id,
          email: player.user.email,
          isAdmin: player.user.isAdmin,
        },
      });
      return appRouter.createCaller(trpcCtx);
    };

    return {
      async createTodo(input) {
        const caller = createCaller();
        const result = await caller.todo.create(input);
        stage.ctx.todoIds.add(result.id);
        return result;
      },

      async getTodo(input) {
        const caller = createCaller();
        return caller.todo.get(input);
      },

      async listTodos(input = {}) {
        const caller = createCaller();
        return caller.todo.list(input);
      },

      async updateTodo(input) {
        const caller = createCaller();
        return caller.todo.update(input);
      },

      async deleteTodo(input) {
        const caller = createCaller();
        return caller.todo.delete(input);
      },

      async toggleTodo(input) {
        const caller = createCaller();
        return caller.todo.toggleComplete(input);
      },

      async getTodoStats() {
        const caller = createCaller();
        return caller.todo.stats();
      },
    };
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  async cleanup(): Promise<void> {
    await this.ctx.cleanup();
  }
}

// ============================================================================
// Player Wrapper - Lazy Loading Magic
// ============================================================================

export function createPlayerWrapper(
  stage: Stage,
  key: string,
  persona: PersonaDefinition,
): Player {
  let playerPromise: Promise<LivePlayer> | null = null;

  const getPlayer = (): Promise<LivePlayer> => {
    if (!playerPromise) {
      playerPromise = stage.getOrCreatePlayer(key, persona);
    }
    return playerPromise;
  };

  return {
    name: persona.name,

    get user(): Promise<User> {
      return getPlayer().then((p) => p.user);
    },

    at(org: Org, role: MemberRole = "member"): Actor {
      // This is a synchronous method that returns an Actor
      // The Actor's methods are async and will trigger lazy loading
      return createLazyActor(stage, getPlayer, org, role);
    },

    owns(org: Org): Actor {
      return this.at(org, "owner");
    },

    administers(org: Org): Actor {
      return this.at(org, "admin");
    },

    sneaksInto(org: Org): Actor {
      return createSneakyLazyActor(stage, getPlayer, org);
    },
  };
}

// ============================================================================
// Org Wrapper - Lazy Loading Magic
// ============================================================================

export function createOrgWrapper(
  stage: Stage,
  key: string,
  def: OrgDefinition,
): Org {
  let orgPromise: Promise<LiveOrg> | null = null;

  const getOrg = (): Promise<LiveOrg> => {
    if (!orgPromise) {
      orgPromise = stage.getOrCreateOrg(key, def);
    }
    return orgPromise;
  };

  return {
    name: def.name,

    get organization(): Promise<Organization> {
      return getOrg().then((o) => o.organization);
    },
  };
}

// ============================================================================
// Lazy Actor - Defers All Work Until Action is Called
// ============================================================================

function createLazyActor(
  stage: Stage,
  getPlayer: () => Promise<LivePlayer>,
  org: Org,
  role: MemberRole,
): Actor {
  // We need to create the actual actor lazily
  let actorPromise: Promise<Actor> | null = null;

  const getActor = async (): Promise<Actor> => {
    if (!actorPromise) {
      actorPromise = (async () => {
        const player = await getPlayer();
        // Await the org's organization promise to get the live org
        const organization = await org.organization;
        const liveOrg: LiveOrg = { organization };
        const membership = await stage.getOrCreateMembership(
          player,
          liveOrg,
          role,
        );
        return stage.createActor(player, liveOrg, membership);
      })();
    }
    return actorPromise;
  };

  // Create a proxy that forwards all method calls to the lazily-loaded actor
  const lazyActions: ActorActions = {
    async createTodo(input) {
      const actor = await getActor();
      return actor.createTodo(input);
    },
    async getTodo(input) {
      const actor = await getActor();
      return actor.getTodo(input);
    },
    async listTodos(input) {
      const actor = await getActor();
      return actor.listTodos(input);
    },
    async updateTodo(input) {
      const actor = await getActor();
      return actor.updateTodo(input);
    },
    async deleteTodo(input) {
      const actor = await getActor();
      return actor.deleteTodo(input);
    },
    async toggleTodo(input) {
      const actor = await getActor();
      return actor.toggleTodo(input);
    },
    async getTodoStats() {
      const actor = await getActor();
      return actor.getTodoStats();
    },
  };

  // Return a pseudo-actor that looks like an Actor but lazy-loads
  return {
    /* c8 ignore start */
    get player(): LivePlayer {
      throw new Error(
        "Cannot access player synchronously on lazy actor - await an action first",
      );
    },
    get org(): LiveOrg {
      throw new Error(
        "Cannot access org synchronously on lazy actor - await an action first",
      );
    },
    get context(): LiveMembership {
      throw new Error(
        "Cannot access context synchronously on lazy actor - await an action first",
      );
    },
    /* c8 ignore stop */
    get role(): MemberRole {
      return role;
    },
    ...lazyActions,
  };
}

function createSneakyLazyActor(
  stage: Stage,
  getPlayer: () => Promise<LivePlayer>,
  org: Org,
): Actor {
  let actorPromise: Promise<Actor> | null = null;

  const getActor = async (): Promise<Actor> => {
    if (!actorPromise) {
      actorPromise = (async () => {
        const player = await getPlayer();
        // Await the org's organization promise to get the live org
        const organization = await org.organization;
        const liveOrg: LiveOrg = { organization };
        const session = await stage.getSneakySession(player, liveOrg);
        return stage.createSneakyActor(player, liveOrg, session);
      })();
    }
    return actorPromise;
  };

  const lazyActions: ActorActions = {
    async createTodo(input) {
      const actor = await getActor();
      return actor.createTodo(input);
    },
    async getTodo(input) {
      const actor = await getActor();
      return actor.getTodo(input);
    },
    async listTodos(input) {
      const actor = await getActor();
      return actor.listTodos(input);
    },
    async updateTodo(input) {
      const actor = await getActor();
      return actor.updateTodo(input);
    },
    async deleteTodo(input) {
      const actor = await getActor();
      return actor.deleteTodo(input);
    },
    async toggleTodo(input) {
      const actor = await getActor();
      return actor.toggleTodo(input);
    },
    async getTodoStats() {
      const actor = await getActor();
      return actor.getTodoStats();
    },
  };

  return {
    /* c8 ignore start */
    get player(): LivePlayer {
      throw new Error(
        "Cannot access player synchronously on lazy actor - await an action first",
      );
    },
    get org(): LiveOrg {
      throw new Error(
        "Cannot access org synchronously on lazy actor - await an action first",
      );
    },
    get context(): LiveMembership {
      throw new Error(
        "Cannot access context synchronously on lazy actor - await an action first",
      );
    },
    /* c8 ignore stop */
    get role(): MemberRole {
      return "member";
    },
    ...lazyActions,
  };
}
