/**
 * Scenario Framework Tests
 *
 * These tests verify the scenario framework itself works correctly.
 * For comprehensive todo router tests, see trpc/routers/todo.test.ts
 */

import { describe, expect } from "bun:test";
import { scenario } from "./index";

describe("scenario framework", () => {
  // ===========================================================================
  // Framework API Verification
  // ===========================================================================

  describe("basic API", () => {
    scenario(
      "scenario function provides players and orgs",
      async ({ alice, bob, acmeCorp, globex }) => {
        // Verify we get players and orgs from context
        expect(alice.name).toBe("Alice");
        expect(bob.name).toBe("Bob");
        expect(acmeCorp.name).toBe("Acme Corporation");
        expect(globex.name).toBe("Globex Corporation");
      },
    );

    scenario(
      "at() creates membership and allows actions",
      async ({ alice, acmeCorp }) => {
        const todo = await alice.at(acmeCorp).createTodo({ title: "Test" });
        expect(todo.title).toBe("Test");
      },
    );

    scenario("owns() creates owner membership", async ({ alice, acmeCorp }) => {
      const todo = await alice.owns(acmeCorp).createTodo({ title: "Owner" });
      const result = await alice.owns(acmeCorp).deleteTodo({ id: todo.id });
      expect(result.success).toBe(true);
    });

    scenario(
      "administers() creates admin membership",
      async ({ alice, acmeCorp }) => {
        const todo = await alice
          .administers(acmeCorp)
          .createTodo({ title: "Admin" });
        const result = await alice
          .administers(acmeCorp)
          .deleteTodo({ id: todo.id });
        expect(result.success).toBe(true);
      },
    );

    scenario(
      "sneaksInto() allows testing access without membership",
      async ({ alice, bob, acmeCorp }) => {
        await alice.owns(acmeCorp).createTodo({ title: "Protected" });
        await expect(bob.sneaksInto(acmeCorp).listTodos()).rejects.toThrow(
          "not a member",
        );
      },
    );
  });

  // ===========================================================================
  // Lazy Loading
  // ===========================================================================

  describe("lazy loading", () => {
    scenario(
      "players are created lazily on first action",
      async ({ alice, acmeCorp }) => {
        // Alice doesn't exist in DB yet
        const todo = await alice.at(acmeCorp).createTodo({ title: "Lazy" });
        // Now Alice exists and created the todo
        expect(todo.title).toBe("Lazy");
      },
    );

    scenario(
      "player.user resolves to the database user",
      async ({ alice, acmeCorp }) => {
        await alice.at(acmeCorp).createTodo({ title: "Materialize" });
        const user = await alice.user;
        expect(user.email).toContain("alice");
      },
    );

    scenario(
      "org.organization resolves to the database organization",
      async ({ alice, acmeCorp }) => {
        await alice.at(acmeCorp).createTodo({ title: "Materialize org" });
        const org = await acmeCorp.organization;
        expect(org.name).toBe("Acme Corporation");
        expect(org.slug).toContain("acme-corp");
      },
    );
  });

  // ===========================================================================
  // Custom Players and Organizations
  // ===========================================================================

  describe("custom entities", () => {
    scenario(
      "createPlayer() creates custom players",
      async ({ createPlayer, createOrg }) => {
        const mallory = createPlayer("Mallory");
        const evilCorp = createOrg("Evil Corp");

        const todo = await mallory.owns(evilCorp).createTodo({
          title: "Custom player todo",
        });

        expect(todo.title).toBe("Custom player todo");
      },
    );

    scenario(
      "custom players can be system admins",
      async ({ alice, acmeCorp, createPlayer, createOrg }) => {
        await alice.at(acmeCorp).createTodo({ title: "User todo" });

        const superAdmin = createPlayer("SuperAdmin", { isAdmin: true });
        const adminHQ = createOrg("Admin HQ");

        const aliceTodos = await alice.at(acmeCorp).listTodos();
        const result = await superAdmin
          .at(adminHQ)
          .getTodo({ id: aliceTodos.items[0].id });

        expect(result.title).toBe("User todo");
      },
    );
  });

  // ===========================================================================
  // Pre-defined Personas
  // ===========================================================================

  describe("personas", () => {
    scenario(
      "sysadmin has cross-org access",
      async ({ alice, sysadmin, acmeCorp, globex }) => {
        const todo = await alice
          .at(acmeCorp)
          .createTodo({ title: "Cross-org" });
        const result = await sysadmin.at(globex).getTodo({ id: todo.id });
        expect(result.title).toBe("Cross-org");
      },
    );

    scenario(
      "charlie and diana are available personas",
      async ({ charlie, diana, initech, umbrella }) => {
        expect(charlie.name).toBe("Charlie");
        expect(diana.name).toBe("Diana");
        expect(initech.name).toBe("Initech");
        expect(umbrella.name).toBe("Umbrella Corporation");
      },
    );

    scenario(
      "eve and wayneEnterprises are available",
      async ({ eve, wayneEnterprises }) => {
        expect(eve.name).toBe("Eve");
        expect(wayneEnterprises.name).toBe("Wayne Enterprises");
      },
    );
  });

  // ===========================================================================
  // Test Isolation
  // ===========================================================================

  describe("isolation", () => {
    scenario(
      "each scenario gets fresh entities",
      async ({ alice, acmeCorp }) => {
        // Create a todo in this scenario
        await alice.at(acmeCorp).createTodo({ title: "Scenario A" });
        const todos = await alice.at(acmeCorp).listTodos();
        // Should only see todos from this scenario
        expect(todos.items.every((t) => t.title === "Scenario A")).toBe(true);
      },
    );

    scenario(
      "previous scenario data is not visible",
      async ({ alice, acmeCorp }) => {
        // This is a fresh scenario - should not see "Scenario A"
        const todos = await alice.at(acmeCorp).listTodos();
        expect(todos.items.some((t) => t.title === "Scenario A")).toBe(false);
      },
    );
  });
});
