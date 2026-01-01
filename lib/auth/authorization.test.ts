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
  disconnectTestPrisma,
  type TestContext,
} from "../test";
import {
  authorize,
  authorizeMinimumRole,
  getRolesAtOrAbove,
  getUserOrganizations,
  getUserRole,
  hasMinimumRole,
  hasRole,
  isInternalAdmin,
  isMemberOf,
  ROLE_HIERARCHY,
} from "./authorization";

describe("role hierarchy utilities", () => {
  describe("ROLE_HIERARCHY", () => {
    test("owner has highest level", () => {
      expect(ROLE_HIERARCHY.owner).toBe(3);
    });

    test("admin has middle level", () => {
      expect(ROLE_HIERARCHY.admin).toBe(2);
    });

    test("member has lowest level", () => {
      expect(ROLE_HIERARCHY.member).toBe(1);
    });

    test("owner > admin > member", () => {
      expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
      expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.member);
    });
  });

  describe("hasMinimumRole", () => {
    test("owner meets owner requirement", () => {
      expect(hasMinimumRole("owner", "owner")).toBe(true);
    });

    test("owner meets admin requirement", () => {
      expect(hasMinimumRole("owner", "admin")).toBe(true);
    });

    test("owner meets member requirement", () => {
      expect(hasMinimumRole("owner", "member")).toBe(true);
    });

    test("admin meets admin requirement", () => {
      expect(hasMinimumRole("admin", "admin")).toBe(true);
    });

    test("admin meets member requirement", () => {
      expect(hasMinimumRole("admin", "member")).toBe(true);
    });

    test("admin does not meet owner requirement", () => {
      expect(hasMinimumRole("admin", "owner")).toBe(false);
    });

    test("member meets member requirement", () => {
      expect(hasMinimumRole("member", "member")).toBe(true);
    });

    test("member does not meet admin requirement", () => {
      expect(hasMinimumRole("member", "admin")).toBe(false);
    });

    test("member does not meet owner requirement", () => {
      expect(hasMinimumRole("member", "owner")).toBe(false);
    });
  });

  describe("hasRole", () => {
    test("returns true when role is in list", () => {
      expect(hasRole("admin", ["owner", "admin"])).toBe(true);
    });

    test("returns false when role is not in list", () => {
      expect(hasRole("member", ["owner", "admin"])).toBe(false);
    });

    test("works with single role", () => {
      expect(hasRole("owner", ["owner"])).toBe(true);
      expect(hasRole("admin", ["owner"])).toBe(false);
    });

    test("works with all roles", () => {
      expect(hasRole("member", ["owner", "admin", "member"])).toBe(true);
    });
  });

  describe("getRolesAtOrAbove", () => {
    test("returns only owner for owner minimum", () => {
      const roles = getRolesAtOrAbove("owner");
      expect(roles).toEqual(["owner"]);
    });

    test("returns owner and admin for admin minimum", () => {
      const roles = getRolesAtOrAbove("admin");
      expect(roles).toContain("owner");
      expect(roles).toContain("admin");
      expect(roles).not.toContain("member");
    });

    test("returns all roles for member minimum", () => {
      const roles = getRolesAtOrAbove("member");
      expect(roles).toContain("owner");
      expect(roles).toContain("admin");
      expect(roles).toContain("member");
    });
  });
});

describe("authorization", () => {
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

  describe("authorize", () => {
    test("returns unauthenticated for non-existent user", async () => {
      const org = await ctx.createOrganization();

      const result = await authorize(ctx.prisma, "non-existent-id", org.id, [
        "member",
      ]);

      expect(result).toEqual({
        authorized: false,
        reason: "unauthenticated",
      });
    });

    test("internal admin bypasses RBAC", async () => {
      const admin = await ctx.createUser({ isAdmin: true });
      const org = await ctx.createOrganization();
      // Admin is NOT a member of this org

      const result = await authorize(ctx.prisma, admin.id, org.id, ["owner"]);

      expect(result).toEqual({
        authorized: true,
        reason: "admin",
      });
    });

    test("internal admin can access any org without membership", async () => {
      const admin = await ctx.createUser({ isAdmin: true });
      const { organization } = await ctx.createUserWithOrg(); // Org with different owner

      const result = await authorize(ctx.prisma, admin.id, organization.id, [
        "member",
      ]);

      expect(result).toEqual({
        authorized: true,
        reason: "admin",
      });
    });

    test("returns no_membership for user not in org", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();
      // User is NOT a member of this org

      const result = await authorize(ctx.prisma, user.id, org.id, ["member"]);

      expect(result).toEqual({
        authorized: false,
        reason: "no_membership",
      });
    });

    test("returns insufficient_role when role not in allowed list", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "member",
      });

      const result = await authorize(
        ctx.prisma,
        user.id,
        organization.id,
        ["owner", "admin"], // member not in list
      );

      expect(result).toEqual({
        authorized: false,
        reason: "insufficient_role",
      });
    });

    test("authorizes user with matching role", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "admin",
      });

      const result = await authorize(ctx.prisma, user.id, organization.id, [
        "admin",
      ]);

      expect(result).toEqual({
        authorized: true,
        reason: "role",
        role: "admin",
      });
    });

    test("authorizes owner for any role requirement", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "owner",
      });

      // Owner should be authorized for all these
      const memberResult = await authorize(
        ctx.prisma,
        user.id,
        organization.id,
        ["member"],
      );
      const adminResult = await authorize(
        ctx.prisma,
        user.id,
        organization.id,
        ["admin"],
      );
      const ownerResult = await authorize(
        ctx.prisma,
        user.id,
        organization.id,
        ["owner"],
      );

      // Note: These will fail for member/admin since authorize checks exact role match
      // Use authorizeMinimumRole for hierarchy-based authorization
      expect(memberResult.authorized).toBe(false);
      expect(adminResult.authorized).toBe(false);
      expect(ownerResult).toEqual({
        authorized: true,
        reason: "role",
        role: "owner",
      });
    });

    test("authorizes when role is in allowed list", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "admin",
      });

      const result = await authorize(ctx.prisma, user.id, organization.id, [
        "owner",
        "admin",
        "member",
      ]);

      expect(result).toEqual({
        authorized: true,
        reason: "role",
        role: "admin",
      });
    });
  });

  describe("authorizeMinimumRole", () => {
    test("owner authorized for member minimum", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "owner",
      });

      const result = await authorizeMinimumRole(
        ctx.prisma,
        user.id,
        organization.id,
        "member",
      );

      expect(result.authorized).toBe(true);
    });

    test("owner authorized for admin minimum", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "owner",
      });

      const result = await authorizeMinimumRole(
        ctx.prisma,
        user.id,
        organization.id,
        "admin",
      );

      expect(result.authorized).toBe(true);
    });

    test("owner authorized for owner minimum", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "owner",
      });

      const result = await authorizeMinimumRole(
        ctx.prisma,
        user.id,
        organization.id,
        "owner",
      );

      expect(result.authorized).toBe(true);
    });

    test("admin authorized for member minimum", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "admin",
      });

      const result = await authorizeMinimumRole(
        ctx.prisma,
        user.id,
        organization.id,
        "member",
      );

      expect(result.authorized).toBe(true);
    });

    test("admin not authorized for owner minimum", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "admin",
      });

      const result = await authorizeMinimumRole(
        ctx.prisma,
        user.id,
        organization.id,
        "owner",
      );

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("insufficient_role");
    });

    test("member not authorized for admin minimum", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "member",
      });

      const result = await authorizeMinimumRole(
        ctx.prisma,
        user.id,
        organization.id,
        "admin",
      );

      expect(result.authorized).toBe(false);
    });

    test("internal admin bypasses minimum role check", async () => {
      const admin = await ctx.createUser({ isAdmin: true });
      const { organization } = await ctx.createUserWithOrg();

      const result = await authorizeMinimumRole(
        ctx.prisma,
        admin.id,
        organization.id,
        "owner",
      );

      expect(result).toEqual({
        authorized: true,
        reason: "admin",
      });
    });
  });

  describe("getUserRole", () => {
    test("returns role for member", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "admin",
      });

      const role = await getUserRole(ctx.prisma, user.id, organization.id);

      expect(role).toBe("admin");
    });

    test("returns null for non-member", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();

      const role = await getUserRole(ctx.prisma, user.id, org.id);

      expect(role).toBeNull();
    });
  });

  describe("isMemberOf", () => {
    test("returns true for member", async () => {
      const { user, organization } = await ctx.createUserWithOrg();

      const result = await isMemberOf(ctx.prisma, user.id, organization.id);

      expect(result).toBe(true);
    });

    test("returns false for non-member", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();

      const result = await isMemberOf(ctx.prisma, user.id, org.id);

      expect(result).toBe(false);
    });
  });

  describe("isInternalAdmin", () => {
    test("returns true for admin user", async () => {
      const admin = await ctx.createUser({ isAdmin: true });

      const result = await isInternalAdmin(ctx.prisma, admin.id);

      expect(result).toBe(true);
    });

    test("returns false for regular user", async () => {
      const user = await ctx.createUser({ isAdmin: false });

      const result = await isInternalAdmin(ctx.prisma, user.id);

      expect(result).toBe(false);
    });

    test("returns false for non-existent user", async () => {
      const result = await isInternalAdmin(ctx.prisma, "non-existent-id");

      expect(result).toBe(false);
    });
  });

  describe("getUserOrganizations", () => {
    test("returns all organizations for a user", async () => {
      const user = await ctx.createUser();
      const org1 = await ctx.createOrganization({ name: "Org 1" });
      const org2 = await ctx.createOrganization({ name: "Org 2" });

      await ctx.createMembership({
        userId: user.id,
        organizationId: org1.id,
        role: "owner",
      });
      await ctx.createMembership({
        userId: user.id,
        organizationId: org2.id,
        role: "member",
      });

      const orgs = await getUserOrganizations(ctx.prisma, user.id);

      expect(orgs).toHaveLength(2);
      expect(orgs.map((o) => o.id).sort()).toEqual([org1.id, org2.id].sort());
    });

    test("includes role in organization data", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();
      await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
        role: "admin",
      });

      const orgs = await getUserOrganizations(ctx.prisma, user.id);

      expect(orgs[0].role).toBe("admin");
    });

    test("includes name and slug in organization data", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization({
        name: "Test Org",
        slug: `${ctx.prefix}test-org`,
      });
      await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
      });

      const orgs = await getUserOrganizations(ctx.prisma, user.id);

      expect(orgs[0].name).toBe("Test Org");
      expect(orgs[0].slug).toBe(`${ctx.prefix}test-org`);
    });

    test("returns empty array for user with no memberships", async () => {
      const user = await ctx.createUser();

      const orgs = await getUserOrganizations(ctx.prisma, user.id);

      expect(orgs).toHaveLength(0);
    });
  });
});

describe("multi-tenant authorization scenarios", () => {
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

  test("user can only access their own organization", async () => {
    const { user: user1, organization: org1 } = await ctx.createUserWithOrg();
    const { organization: org2 } = await ctx.createUserWithOrg();

    // user1 can access org1
    const result1 = await authorize(ctx.prisma, user1.id, org1.id, ["owner"]);
    expect(result1.authorized).toBe(true);

    // user1 cannot access org2
    const result2 = await authorize(ctx.prisma, user1.id, org2.id, ["member"]);
    expect(result2.authorized).toBe(false);
    expect(result2.reason).toBe("no_membership");
  });

  test("user with multiple org memberships", async () => {
    const user = await ctx.createUser();
    const org1 = await ctx.createOrganization();
    const org2 = await ctx.createOrganization();
    const org3 = await ctx.createOrganization();

    await ctx.createMembership({
      userId: user.id,
      organizationId: org1.id,
      role: "owner",
    });
    await ctx.createMembership({
      userId: user.id,
      organizationId: org2.id,
      role: "admin",
    });
    await ctx.createMembership({
      userId: user.id,
      organizationId: org3.id,
      role: "member",
    });

    // Can access all three
    expect(
      (await authorize(ctx.prisma, user.id, org1.id, ["owner"])).authorized,
    ).toBe(true);
    expect(
      (await authorize(ctx.prisma, user.id, org2.id, ["admin"])).authorized,
    ).toBe(true);
    expect(
      (await authorize(ctx.prisma, user.id, org3.id, ["member"])).authorized,
    ).toBe(true);

    // Role-specific checks
    expect(
      (await authorizeMinimumRole(ctx.prisma, user.id, org3.id, "admin"))
        .authorized,
    ).toBe(false);
  });

  test("internal admin customer support scenario", async () => {
    // Create customer org
    const { user: customer, organization: customerOrg } =
      await ctx.createUserWithOrg();

    // Create internal support user
    const supportUser = await ctx.createUser({ isAdmin: true });

    // Support user can access customer's org without membership
    const result = await authorize(ctx.prisma, supportUser.id, customerOrg.id, [
      "member",
    ]);

    expect(result).toEqual({
      authorized: true,
      reason: "admin",
    });

    // Customer cannot access other orgs
    const { organization: otherOrg } = await ctx.createUserWithOrg();
    const customerResult = await authorize(
      ctx.prisma,
      customer.id,
      otherOrg.id,
      ["member"],
    );
    expect(customerResult.authorized).toBe(false);
  });
});
