/**
 * The Scenario Function - Where Magic Meets Testing
 *
 * This is the main entry point for writing beautiful, readable tests.
 *
 * @example
 * ```typescript
 * scenario("Alice creates a todo at AcmeCorp", async ({ alice, acmeCorp }) => {
 *   await alice.at(acmeCorp).createTodo({ title: "Buy milk" });
 *
 *   const todos = await alice.at(acmeCorp).listTodos();
 *   expect(todos.items).toHaveLength(1);
 *   expect(todos.items[0].title).toBe("Buy milk");
 * });
 * ```
 */

import { afterAll, test } from "bun:test";
import { disconnectTestPrisma } from "../harness";
import { ORGS, PERSONAS } from "./personas";
import { createOrgWrapper, createPlayerWrapper, Stage } from "./stage";
import type { Org, Player, ScenarioContext, ScenarioFn } from "./types";

// Track all stages for cleanup
const allStages: Stage[] = [];

// Register global cleanup (only runs if a test fails before its cleanup)
/* c8 ignore start */
afterAll(async () => {
  for (const stage of allStages) {
    await stage.cleanup();
  }
  await disconnectTestPrisma();
});
/* c8 ignore stop */

/**
 * Define a test scenario with well-known players and organizations
 *
 * Each scenario gets its own isolated instances of all entities.
 * Alice in one scenario is completely separate from Alice in another.
 *
 * @param name - The name of the scenario (used as test name)
 * @param fn - The scenario function receiving the context
 *
 * @example
 * ```typescript
 * scenario("Alice creates a todo", async ({ alice, acmeCorp }) => {
 *   await alice.at(acmeCorp).createTodo({ title: "Buy milk" });
 * });
 *
 * scenario("Bob cannot see Alice's todos", async ({ alice, bob, acmeCorp, globex }) => {
 *   await alice.at(acmeCorp).createTodo({ title: "Secret" });
 *
 *   // Bob is at a different org
 *   const bobsTodos = await bob.at(globex).listTodos();
 *   expect(bobsTodos.items).toHaveLength(0);
 * });
 * ```
 */
export function scenario(name: string, fn: ScenarioFn): void {
  test(name, async () => {
    const stage = new Stage();
    allStages.push(stage);

    try {
      const ctx = createScenarioContext(stage);
      await fn(ctx);
    } finally {
      await stage.cleanup();
      // Remove from allStages since we cleaned up
      const idx = allStages.indexOf(stage);
      if (idx >= 0) allStages.splice(idx, 1);
    }
  });
}

/**
 * Create the scenario context with all players and orgs
 */
function createScenarioContext(stage: Stage): ScenarioContext {
  // Create player wrappers for all personas
  const alice = createPlayerWrapper(stage, "alice", PERSONAS.alice);
  const bob = createPlayerWrapper(stage, "bob", PERSONAS.bob);
  const charlie = createPlayerWrapper(stage, "charlie", PERSONAS.charlie);
  const diana = createPlayerWrapper(stage, "diana", PERSONAS.diana);
  const eve = createPlayerWrapper(stage, "eve", PERSONAS.eve);
  const sysadmin = createPlayerWrapper(stage, "sysadmin", PERSONAS.sysadmin);

  // Create org wrappers for all standard orgs
  const acmeCorp = createOrgWrapper(stage, "acmeCorp", ORGS.acmeCorp);
  const globex = createOrgWrapper(stage, "globex", ORGS.globex);
  const initech = createOrgWrapper(stage, "initech", ORGS.initech);
  const umbrella = createOrgWrapper(stage, "umbrella", ORGS.umbrella);
  const wayneEnterprises = createOrgWrapper(
    stage,
    "wayneEnterprises",
    ORGS.wayneEnterprises,
  );

  // Dynamic creation functions
  let customPlayerCounter = 0;
  let customOrgCounter = 0;

  const createPlayer = (
    name: string,
    traits?: { isAdmin?: boolean },
  ): Player => {
    const key = `custom_player_${customPlayerCounter++}`;
    return createPlayerWrapper(stage, key, {
      name,
      traits: traits ?? {},
    });
  };

  const createOrg = (name: string): Org => {
    const key = `custom_org_${customOrgCounter++}`;
    return createOrgWrapper(stage, key, {
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
    });
  };

  return {
    // Players
    alice,
    bob,
    charlie,
    diana,
    eve,
    sysadmin,

    // Organizations
    acmeCorp,
    globex,
    initech,
    umbrella,
    wayneEnterprises,

    // Dynamic creation
    createPlayer,
    createOrg,
  };
}

/**
 * Skip a scenario (for temporarily disabling tests)
 */
/* c8 ignore start */
export function xscenario(name: string, _fn: ScenarioFn): void {
  test.skip(name, () => {});
}

/**
 * Focus on a specific scenario (only runs this test)
 */
export function fscenario(name: string, fn: ScenarioFn): void {
  test.only(name, async () => {
    const stage = new Stage();
    allStages.push(stage);

    try {
      const ctx = createScenarioContext(stage);
      await fn(ctx);
    } finally {
      await stage.cleanup();
      const idx = allStages.indexOf(stage);
      if (idx >= 0) allStages.splice(idx, 1);
    }
  });
}
/* c8 ignore stop */
