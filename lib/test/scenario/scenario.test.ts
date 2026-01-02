/**
 * Scenario Framework Tests
 *
 * These tests demonstrate the beauty of the scenario-based framework.
 * Notice how each test reads like a story.
 */

import { describe, expect } from "bun:test";
import { scenario } from "./index";

describe("scenario framework", () => {
  // =========================================================================
  // Basic CRUD Operations
  // =========================================================================

  scenario(
    "Alice creates her first todo at Acme Corp",
    async ({ alice, acmeCorp }) => {
      const todo = await alice.at(acmeCorp).createTodo({
        title: "Buy milk",
        description: "Get the good stuff",
      });

      expect(todo.title).toBe("Buy milk");
      expect(todo.description).toBe("Get the good stuff");
      expect(todo.completed).toBe(false);
    },
  );

  scenario(
    "Alice can create a todo without description",
    async ({ alice, acmeCorp }) => {
      const todo = await alice.at(acmeCorp).createTodo({
        title: "Quick task",
      });

      expect(todo.title).toBe("Quick task");
      expect(todo.description).toBeNull();
    },
  );

  scenario("Alice can retrieve her todo", async ({ alice, acmeCorp }) => {
    const created = await alice.at(acmeCorp).createTodo({ title: "Find me" });

    const found = await alice.at(acmeCorp).getTodo({ id: created.id });

    expect(found.id).toBe(created.id);
    expect(found.title).toBe("Find me");
    expect(found.createdBy.email).toContain("alice");
  });

  scenario("Alice can list all her todos", async ({ alice, acmeCorp }) => {
    await alice.at(acmeCorp).createTodo({ title: "First task" });
    await alice.at(acmeCorp).createTodo({ title: "Second task" });
    await alice.at(acmeCorp).createTodo({ title: "Third task" });

    const todos = await alice.at(acmeCorp).listTodos();

    expect(todos.items.length).toBeGreaterThanOrEqual(3);
  });

  scenario("Alice can update her todo", async ({ alice, acmeCorp }) => {
    const todo = await alice.at(acmeCorp).createTodo({
      title: "Original",
      description: "Before update",
    });

    const updated = await alice.at(acmeCorp).updateTodo({
      id: todo.id,
      title: "Modified",
      description: "After update",
    });

    expect(updated.title).toBe("Modified");
    expect(updated.description).toBe("After update");
  });

  scenario(
    "Alice can partially update her todo",
    async ({ alice, acmeCorp }) => {
      const todo = await alice.at(acmeCorp).createTodo({
        title: "Original Title",
        description: "Keep this",
      });

      const updated = await alice.at(acmeCorp).updateTodo({
        id: todo.id,
        title: "New Title",
      });

      expect(updated.title).toBe("New Title");
      expect(updated.description).toBe("Keep this");
    },
  );

  scenario(
    "Alice can clear a todo description",
    async ({ alice, acmeCorp }) => {
      const todo = await alice.at(acmeCorp).createTodo({
        title: "Has Description",
        description: "Remove me",
      });

      const updated = await alice.at(acmeCorp).updateTodo({
        id: todo.id,
        description: null,
      });

      expect(updated.description).toBeNull();
    },
  );

  scenario("Alice can toggle todo completion", async ({ alice, acmeCorp }) => {
    const todo = await alice.at(acmeCorp).createTodo({ title: "Toggle me" });
    expect(todo.completed).toBe(false);

    const toggled = await alice.at(acmeCorp).toggleTodo({ id: todo.id });
    expect(toggled.completed).toBe(true);

    const toggledBack = await alice.at(acmeCorp).toggleTodo({ id: todo.id });
    expect(toggledBack.completed).toBe(false);
  });

  scenario("Alice as admin can delete todos", async ({ alice, acmeCorp }) => {
    const todo = await alice
      .administers(acmeCorp)
      .createTodo({ title: "Delete me" });

    const result = await alice
      .administers(acmeCorp)
      .deleteTodo({ id: todo.id });

    expect(result.success).toBe(true);
  });

  scenario("Alice as owner can delete todos", async ({ alice, acmeCorp }) => {
    const todo = await alice
      .owns(acmeCorp)
      .createTodo({ title: "Owner deletes" });

    const result = await alice.owns(acmeCorp).deleteTodo({ id: todo.id });

    expect(result.success).toBe(true);
  });

  // =========================================================================
  // Filtering and Pagination
  // =========================================================================

  scenario(
    "Alice can filter todos by completion status",
    async ({ alice, acmeCorp }) => {
      await alice.at(acmeCorp).createTodo({ title: "Done" });
      await alice.at(acmeCorp).createTodo({ title: "Also done" });
      await alice.at(acmeCorp).createTodo({ title: "Not done" });

      // Complete the first two
      const todos = await alice.at(acmeCorp).listTodos();
      await alice.at(acmeCorp).toggleTodo({ id: todos.items[0].id });
      await alice.at(acmeCorp).toggleTodo({ id: todos.items[1].id });

      const completed = await alice.at(acmeCorp).listTodos({ completed: true });
      const pending = await alice.at(acmeCorp).listTodos({ completed: false });

      expect(completed.items.every((t) => t.completed)).toBe(true);
      expect(pending.items.every((t) => !t.completed)).toBe(true);
    },
  );

  scenario("Alice can paginate through todos", async ({ alice, acmeCorp }) => {
    // Create several todos
    for (let i = 0; i < 5; i++) {
      await alice.at(acmeCorp).createTodo({ title: `Todo ${i}` });
    }

    const page1 = await alice.at(acmeCorp).listTodos({ limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await alice.at(acmeCorp).listTodos({
      limit: 2,
      cursor: page1.nextCursor,
    });
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
  });

  scenario("Alice can get todo statistics", async ({ alice, acmeCorp }) => {
    await alice.at(acmeCorp).createTodo({ title: "Done 1" });
    await alice.at(acmeCorp).createTodo({ title: "Done 2" });
    await alice.at(acmeCorp).createTodo({ title: "Pending" });

    const todos = await alice.at(acmeCorp).listTodos();
    await alice.at(acmeCorp).toggleTodo({ id: todos.items[0].id });
    await alice.at(acmeCorp).toggleTodo({ id: todos.items[1].id });

    const stats = await alice.at(acmeCorp).getTodoStats();

    expect(stats.total).toBeGreaterThanOrEqual(3);
    expect(stats.completed).toBeGreaterThanOrEqual(2);
    expect(stats.pending).toBeGreaterThanOrEqual(1);
    expect(stats.completionRate).toBeGreaterThanOrEqual(0);
    expect(stats.completionRate).toBeLessThanOrEqual(100);
  });

  // =========================================================================
  // Multi-Tenant Isolation
  // =========================================================================

  scenario(
    "Alice and Bob work in separate organizations",
    async ({ alice, bob, acmeCorp, globex }) => {
      await alice.at(acmeCorp).createTodo({ title: "Alice's secret project" });
      await bob.at(globex).createTodo({ title: "Bob's work" });

      const aliceTodos = await alice.at(acmeCorp).listTodos();
      const bobTodos = await bob.at(globex).listTodos();

      // Each sees only their own org's todos
      expect(
        aliceTodos.items.some((t) => t.title === "Alice's secret project"),
      ).toBe(true);
      expect(aliceTodos.items.some((t) => t.title === "Bob's work")).toBe(
        false,
      );

      expect(bobTodos.items.some((t) => t.title === "Bob's work")).toBe(true);
      expect(
        bobTodos.items.some((t) => t.title === "Alice's secret project"),
      ).toBe(false);
    },
  );

  scenario(
    "Bob cannot sneak into Alice's organization",
    async ({ alice, bob, acmeCorp }) => {
      await alice.owns(acmeCorp).createTodo({ title: "Confidential" });

      // Bob tries to sneak in without membership
      await expect(bob.sneaksInto(acmeCorp).listTodos()).rejects.toThrow(
        "not a member",
      );
    },
  );

  scenario(
    "Bob sneaking in cannot create todos",
    async ({ alice, bob, acmeCorp }) => {
      await alice.owns(acmeCorp).createTodo({ title: "Legit todo" });

      await expect(
        bob.sneaksInto(acmeCorp).createTodo({ title: "Sneaky todo" }),
      ).rejects.toThrow("not a member");
    },
  );

  scenario(
    "Bob sneaking in cannot update todos",
    async ({ alice, bob, acmeCorp }) => {
      const todo = await alice.owns(acmeCorp).createTodo({ title: "Original" });

      await expect(
        bob.sneaksInto(acmeCorp).updateTodo({ id: todo.id, title: "Hacked" }),
      ).rejects.toThrow("not a member");
    },
  );

  scenario(
    "Bob sneaking in cannot delete todos",
    async ({ alice, bob, acmeCorp }) => {
      const todo = await alice
        .owns(acmeCorp)
        .createTodo({ title: "Protected" });

      await expect(
        bob.sneaksInto(acmeCorp).deleteTodo({ id: todo.id }),
      ).rejects.toThrow("not a member");
    },
  );

  scenario(
    "Bob sneaking in cannot toggle todos",
    async ({ alice, bob, acmeCorp }) => {
      const todo = await alice
        .owns(acmeCorp)
        .createTodo({ title: "Untoggleable" });

      await expect(
        bob.sneaksInto(acmeCorp).toggleTodo({ id: todo.id }),
      ).rejects.toThrow("not a member");
    },
  );

  scenario(
    "Bob sneaking in cannot get todos",
    async ({ alice, bob, acmeCorp }) => {
      const todo = await alice.owns(acmeCorp).createTodo({ title: "Hidden" });

      await expect(
        bob.sneaksInto(acmeCorp).getTodo({ id: todo.id }),
      ).rejects.toThrow("not a member");
    },
  );

  scenario(
    "Bob sneaking in cannot get stats",
    async ({ alice, bob, acmeCorp }) => {
      await alice.owns(acmeCorp).createTodo({ title: "Counted" });

      await expect(bob.sneaksInto(acmeCorp).getTodoStats()).rejects.toThrow(
        "not a member",
      );
    },
  );

  scenario(
    "Bob cannot access Alice's todo directly",
    async ({ alice, bob, acmeCorp, globex }) => {
      const aliceTodo = await alice
        .at(acmeCorp)
        .createTodo({ title: "Private" });

      await expect(
        bob.at(globex).getTodo({ id: aliceTodo.id }),
      ).rejects.toThrow("do not have access");
    },
  );

  scenario(
    "Bob cannot update Alice's todo",
    async ({ alice, bob, acmeCorp, globex }) => {
      const aliceTodo = await alice
        .at(acmeCorp)
        .createTodo({ title: "Original" });

      await expect(
        bob.at(globex).updateTodo({ id: aliceTodo.id, title: "Hacked!" }),
      ).rejects.toThrow("do not have access");
    },
  );

  scenario(
    "Bob cannot delete Alice's todo even as admin",
    async ({ alice, bob, acmeCorp, globex }) => {
      const aliceTodo = await alice
        .at(acmeCorp)
        .createTodo({ title: "Protected" });

      await expect(
        bob.administers(globex).deleteTodo({ id: aliceTodo.id }),
      ).rejects.toThrow("do not have access");
    },
  );

  scenario(
    "Bob cannot toggle Alice's todo",
    async ({ alice, bob, acmeCorp, globex }) => {
      const aliceTodo = await alice
        .at(acmeCorp)
        .createTodo({ title: "Untouchable" });

      await expect(
        bob.at(globex).toggleTodo({ id: aliceTodo.id }),
      ).rejects.toThrow("do not have access");
    },
  );

  // =========================================================================
  // Role-Based Access Control
  // =========================================================================

  scenario(
    "Regular member cannot delete todos",
    async ({ alice, bob, acmeCorp }) => {
      const todo = await alice
        .owns(acmeCorp)
        .createTodo({ title: "No delete for you" });

      // Bob joins as regular member
      await expect(
        bob.at(acmeCorp).deleteTodo({ id: todo.id }),
      ).rejects.toThrow("Only organization admins");
    },
  );

  // =========================================================================
  // System Administrator Powers
  // =========================================================================

  scenario(
    "Sysadmin can view any organization's todos",
    async ({ alice, sysadmin, acmeCorp }) => {
      await alice.at(acmeCorp).createTodo({ title: "User's todo" });

      // Sysadmin has superpowers
      const todos = await sysadmin.at(acmeCorp).listTodos();

      expect(todos.items.some((t) => t.title === "User's todo")).toBe(true);
    },
  );

  scenario(
    "Sysadmin can update any organization's todos",
    async ({ alice, sysadmin, acmeCorp, initech }) => {
      const todo = await alice.at(acmeCorp).createTodo({ title: "Original" });

      // Sysadmin updates from a different org context
      const updated = await sysadmin.at(initech).updateTodo({
        id: todo.id,
        title: "Admin Updated",
      });

      expect(updated.title).toBe("Admin Updated");
    },
  );

  scenario(
    "Sysadmin can toggle any todo",
    async ({ alice, sysadmin, acmeCorp, globex }) => {
      const todo = await alice.at(acmeCorp).createTodo({ title: "Toggle me" });

      const toggled = await sysadmin.at(globex).toggleTodo({ id: todo.id });

      expect(toggled.completed).toBe(true);
    },
  );

  scenario(
    "Sysadmin can delete any todo",
    async ({ alice, sysadmin, acmeCorp }) => {
      const todo = await alice.at(acmeCorp).createTodo({ title: "Delete me" });

      const result = await sysadmin.at(acmeCorp).deleteTodo({ id: todo.id });

      expect(result.success).toBe(true);
    },
  );

  // =========================================================================
  // Error Cases
  // =========================================================================

  scenario(
    "Getting a non-existent todo returns 404",
    async ({ alice, acmeCorp }) => {
      await expect(
        alice.at(acmeCorp).getTodo({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
      ).rejects.toThrow("not found");
    },
  );

  scenario(
    "Updating a non-existent todo returns 404",
    async ({ alice, acmeCorp }) => {
      await expect(
        alice
          .at(acmeCorp)
          .updateTodo({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx", title: "New" }),
      ).rejects.toThrow("not found");
    },
  );

  scenario(
    "Deleting a non-existent todo returns 404",
    async ({ alice, acmeCorp }) => {
      await expect(
        alice
          .administers(acmeCorp)
          .deleteTodo({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
      ).rejects.toThrow("not found");
    },
  );

  scenario(
    "Toggling a non-existent todo returns 404",
    async ({ alice, acmeCorp }) => {
      await expect(
        alice.at(acmeCorp).toggleTodo({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
      ).rejects.toThrow("not found");
    },
  );

  // =========================================================================
  // Custom Players and Organizations
  // =========================================================================

  scenario(
    "Custom players and orgs can be created",
    async ({ createPlayer, createOrg }) => {
      const mallory = createPlayer("Mallory");
      const evilCorp = createOrg("Evil Corp");

      const todo = await mallory.owns(evilCorp).createTodo({
        title: "World domination",
      });

      expect(todo.title).toBe("World domination");
    },
  );

  scenario(
    "Player user property can be accessed",
    async ({ alice, acmeCorp }) => {
      // Create something to materialize Alice
      await alice.at(acmeCorp).createTodo({ title: "Materialize me" });

      // Now we can access the user
      const user = await alice.user;
      expect(user.email).toContain("alice");
    },
  );

  scenario("Player name is accessible", async ({ alice }) => {
    expect(alice.name).toBe("Alice");
  });

  scenario("Org name is accessible", async ({ alice, acmeCorp }) => {
    expect(acmeCorp.name).toBe("Acme Corporation");
  });

  scenario("Org can be accessed lazily", async ({ alice, acmeCorp }) => {
    const org = await acmeCorp.organization;
    expect(org.name).toBe("Acme Corporation");
    expect(org.slug).toContain("acme-corp");
  });

  scenario(
    "Custom admin player has superpowers",
    async ({ alice, acmeCorp, createPlayer, createOrg }) => {
      await alice.at(acmeCorp).createTodo({ title: "User todo" });

      const superAdmin = createPlayer("SuperAdmin", { isAdmin: true });
      const adminHQ = createOrg("Admin HQ");

      // SuperAdmin can see Alice's todo from a different org
      const _todos = await superAdmin.at(adminHQ).listTodos();
      // Note: This lists Admin HQ's todos, but sysadmin can access alice's todo directly
      const aliceTodo = await alice.at(acmeCorp).listTodos();
      const result = await superAdmin
        .at(adminHQ)
        .getTodo({ id: aliceTodo.items[0].id });

      expect(result.title).toBe("User todo");
    },
  );

  // =========================================================================
  // Team Collaboration
  // =========================================================================

  scenario(
    "Alice and Bob collaborate at the same org",
    async ({ alice, bob, acmeCorp }) => {
      await alice.at(acmeCorp).createTodo({ title: "Alice's task" });
      await bob.at(acmeCorp).createTodo({ title: "Bob's task" });

      // Both can see all todos
      const aliceView = await alice.at(acmeCorp).listTodos();
      const bobView = await bob.at(acmeCorp).listTodos();

      expect(aliceView.items.some((t) => t.title === "Bob's task")).toBe(true);
      expect(bobView.items.some((t) => t.title === "Alice's task")).toBe(true);
    },
  );

  scenario(
    "Team members can update each other's todos",
    async ({ alice, bob, acmeCorp }) => {
      const aliceTodo = await alice
        .at(acmeCorp)
        .createTodo({ title: "Help me Bob" });

      const updated = await bob.at(acmeCorp).updateTodo({
        id: aliceTodo.id,
        title: "Done!",
        completed: true,
      });

      expect(updated.title).toBe("Done!");
      expect(updated.completed).toBe(true);
    },
  );

  scenario(
    "Team members can toggle each other's todos",
    async ({ alice, bob, acmeCorp }) => {
      const aliceTodo = await alice
        .at(acmeCorp)
        .createTodo({ title: "Check me" });

      const toggled = await bob.at(acmeCorp).toggleTodo({ id: aliceTodo.id });

      expect(toggled.completed).toBe(true);
    },
  );

  // =========================================================================
  // Empty State
  // =========================================================================

  scenario("New organization has no todos", async ({ charlie, initech }) => {
    const todos = await charlie.at(initech).listTodos();

    expect(todos.items).toHaveLength(0);
  });

  scenario("Fresh org has zero stats", async ({ charlie, initech }) => {
    const stats = await charlie.at(initech).getTodoStats();

    expect(stats.total).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.pending).toBe(0);
  });
});
