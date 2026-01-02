/**
 * Scenario-Based Test Framework
 *
 * A beautiful, fluent API for writing tests that read like stories.
 *
 * @example
 * ```typescript
 * import { scenario } from "../lib/test/scenario";
 * import { expect } from "bun:test";
 *
 * scenario("Alice creates a todo at AcmeCorp", async ({ alice, acmeCorp }) => {
 *   await alice.at(acmeCorp).createTodo({ title: "Buy milk" });
 *
 *   const todos = await alice.at(acmeCorp).listTodos();
 *   expect(todos.items).toHaveLength(1);
 * });
 *
 * scenario("Bob cannot access Alice's org", async ({ alice, bob, acmeCorp, globex }) => {
 *   await alice.owns(acmeCorp).createTodo({ title: "Secret" });
 *
 *   // Bob tries to sneak into AcmeCorp
 *   await expect(bob.sneaksInto(acmeCorp).listTodos()).rejects.toThrow();
 * });
 *
 * scenario("Sysadmin can see everything", async ({ alice, acmeCorp, sysadmin }) => {
 *   await alice.at(acmeCorp).createTodo({ title: "User todo" });
 *
 *   // Sysadmin has superpowers
 *   const todos = await sysadmin.at(acmeCorp).listTodos();
 *   expect(todos.items).toHaveLength(1);
 * });
 * ```
 *
 * ## Players
 *
 * - `alice`, `bob`, `charlie`, `diana`, `eve` - Regular users
 * - `sysadmin` - System administrator with isAdmin=true
 *
 * ## Organizations
 *
 * - `acmeCorp` - Acme Corporation
 * - `globex` - Globex Corporation
 * - `initech` - Initech
 * - `umbrella` - Umbrella Corporation
 * - `wayneEnterprises` - Wayne Enterprises
 *
 * ## Player Actions
 *
 * - `player.at(org)` - Join as member
 * - `player.at(org, "admin")` - Join with specific role
 * - `player.owns(org)` - Join as owner
 * - `player.administers(org)` - Join as admin
 * - `player.sneaksInto(org)` - Try to access without membership (for testing access control)
 *
 * ## Todo Actions
 *
 * - `actor.createTodo({ title, description? })`
 * - `actor.getTodo({ id })`
 * - `actor.listTodos({ completed?, limit?, cursor? })`
 * - `actor.updateTodo({ id, title?, description?, completed? })`
 * - `actor.deleteTodo({ id })`
 * - `actor.toggleTodo({ id })`
 * - `actor.getTodoStats()`
 *
 * ## Creating Custom Players/Orgs
 *
 * ```typescript
 * scenario("Custom entities", async ({ createPlayer, createOrg }) => {
 *   const mallory = createPlayer("Mallory", { isAdmin: true });
 *   const evilCorp = createOrg("Evil Corp");
 *
 *   await mallory.owns(evilCorp).createTodo({ title: "World domination" });
 * });
 * ```
 */

export { fscenario, scenario, xscenario } from "./scenario";
export type {
  Actor,
  ActorActions,
  Org,
  Player,
  ScenarioContext,
  ScenarioFn,
  TodoListResult,
  TodoResult,
  TodoStatsResult,
  TodoWithCreator,
} from "./types";
