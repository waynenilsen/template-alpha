import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import {
  createTestContext,
  createTestUserWithPassword,
  disconnectTestPrisma,
  type TestContext,
} from "../test";
import { verifyPassword } from "./password";

describe("user management", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  describe("createUser", () => {
    test("creates a user with default values", async () => {
      const user = await ctx.createUser();

      expect(user.id).toBeDefined();
      expect(user.email).toContain("@test.local");
      expect(user.passwordHash).toBeDefined();
      expect(user.isAdmin).toBe(false);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    test("creates a user with custom email", async () => {
      const email = `${ctx.prefix}custom@example.com`;
      const user = await ctx.createUser({ email });

      expect(user.email).toBe(email);
    });

    test("creates an admin user when specified", async () => {
      const user = await ctx.createUser({ isAdmin: true });

      expect(user.isAdmin).toBe(true);
    });

    test("hashes the password correctly", async () => {
      const password = "MySecurePass123";
      const user = await ctx.createUser({ password });

      const isValid = await verifyPassword(password, user.passwordHash);
      expect(isValid).toBe(true);
    });

    test("user can be retrieved from database", async () => {
      const user = await ctx.createUser();

      const retrieved = await ctx.prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(retrieved).not.toBeNull();
      expect(retrieved?.email).toBe(user.email);
    });
  });

  describe("createTestUserWithPassword", () => {
    test("returns user and plain password", async () => {
      const { user, password } = await createTestUserWithPassword(ctx);

      expect(user.id).toBeDefined();
      expect(password).toBe("TestPassword123");

      const isValid = await verifyPassword(password, user.passwordHash);
      expect(isValid).toBe(true);
    });

    test("uses custom password when provided", async () => {
      const customPassword = "CustomPass456";
      const { user, password } = await createTestUserWithPassword(ctx, {
        password: customPassword,
      });

      expect(password).toBe(customPassword);

      const isValid = await verifyPassword(password, user.passwordHash);
      expect(isValid).toBe(true);
    });
  });

  describe("user uniqueness", () => {
    test("prevents duplicate emails", async () => {
      const email = `${ctx.prefix}duplicate@example.com`;
      await ctx.createUser({ email });

      await expect(ctx.createUser({ email })).rejects.toThrow();
    });
  });

  describe("user queries", () => {
    test("finds user by email", async () => {
      const email = `${ctx.prefix}findme@example.com`;
      const user = await ctx.createUser({ email });

      const found = await ctx.prisma.user.findUnique({
        where: { email },
      });

      expect(found).not.toBeNull();
      expect(found?.id).toBe(user.id);
    });

    test("returns null for non-existent email", async () => {
      const found = await ctx.prisma.user.findUnique({
        where: { email: "nonexistent@example.com" },
      });

      expect(found).toBeNull();
    });

    test("can query admin users", async () => {
      await ctx.createUser({ isAdmin: false });
      const admin = await ctx.createUser({ isAdmin: true });

      const admins = await ctx.prisma.user.findMany({
        where: {
          isAdmin: true,
          id: { in: Array.from(ctx.userIds) },
        },
      });

      expect(admins).toHaveLength(1);
      expect(admins[0].id).toBe(admin.id);
    });
  });

  describe("user updates", () => {
    test("updates user email", async () => {
      const user = await ctx.createUser();
      const newEmail = `${ctx.prefix}updated@example.com`;

      const updated = await ctx.prisma.user.update({
        where: { id: user.id },
        data: { email: newEmail },
      });

      expect(updated.email).toBe(newEmail);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        user.updatedAt.getTime(),
      );
    });

    test("updates user admin status", async () => {
      const user = await ctx.createUser({ isAdmin: false });

      const updated = await ctx.prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true },
      });

      expect(updated.isAdmin).toBe(true);
    });
  });

  describe("user deletion", () => {
    test("deletes a user", async () => {
      const user = await ctx.createUser();

      await ctx.prisma.user.delete({ where: { id: user.id } });
      ctx.userIds.delete(user.id); // Remove from tracking since we deleted it

      const found = await ctx.prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(found).toBeNull();
    });
  });
});

describe("parallel user creation", () => {
  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("multiple test contexts can create users in parallel", async () => {
    const ctx1 = createTestContext();
    const ctx2 = createTestContext();
    const ctx3 = createTestContext();

    try {
      // Create users in parallel across different contexts
      const [user1, user2, user3] = await Promise.all([
        ctx1.createUser(),
        ctx2.createUser(),
        ctx3.createUser(),
      ]);

      // Each user should have a unique ID
      expect(user1.id).not.toBe(user2.id);
      expect(user2.id).not.toBe(user3.id);
      expect(user1.id).not.toBe(user3.id);

      // Each user should have a unique email
      expect(user1.email).not.toBe(user2.email);
      expect(user2.email).not.toBe(user3.email);
      expect(user1.email).not.toBe(user3.email);
    } finally {
      await Promise.all([ctx1.cleanup(), ctx2.cleanup(), ctx3.cleanup()]);
    }
  });

  test("cleanup only removes records from its own context", async () => {
    const ctx1 = createTestContext();
    const ctx2 = createTestContext();

    const user1 = await ctx1.createUser();
    const user2 = await ctx2.createUser();

    // Cleanup ctx1
    await ctx1.cleanup();

    // user1 should be deleted
    const found1 = await ctx2.prisma.user.findUnique({
      where: { id: user1.id },
    });
    expect(found1).toBeNull();

    // user2 should still exist
    const found2 = await ctx2.prisma.user.findUnique({
      where: { id: user2.id },
    });
    expect(found2).not.toBeNull();

    await ctx2.cleanup();
  });
});
