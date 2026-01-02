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

describe("organization management", () => {
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

  describe("createOrganization", () => {
    test("creates an organization with default values", async () => {
      const org = await ctx.createOrganization();

      expect(org.id).toBeDefined();
      expect(org.name).toContain(ctx.prefix);
      expect(org.slug).toContain(ctx.prefix);
      expect(org.createdAt).toBeInstanceOf(Date);
      expect(org.updatedAt).toBeInstanceOf(Date);
    });

    test("creates an organization with custom name and slug", async () => {
      const name = "My Company";
      const slug = `${ctx.prefix}my-company`;
      const org = await ctx.createOrganization({ name, slug });

      expect(org.name).toBe(name);
      expect(org.slug).toBe(slug);
    });

    test("organization can be retrieved from database", async () => {
      const org = await ctx.createOrganization();

      const retrieved = await ctx.prisma.organization.findUnique({
        where: { id: org.id },
      });

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe(org.name);
    });
  });

  describe("organization uniqueness", () => {
    test("prevents duplicate slugs", async () => {
      const slug = `${ctx.prefix}unique-slug`;
      await ctx.createOrganization({ slug });

      await expect(ctx.createOrganization({ slug })).rejects.toThrow();
    });

    test("allows duplicate names with different slugs", async () => {
      const name = "Same Name Inc";
      await ctx.createOrganization({ name, slug: `${ctx.prefix}slug-1` });
      const org2 = await ctx.createOrganization({
        name,
        slug: `${ctx.prefix}slug-2`,
      });

      expect(org2.name).toBe(name);
    });
  });

  describe("organization queries", () => {
    test("finds organization by slug", async () => {
      const slug = `${ctx.prefix}findable-org`;
      const org = await ctx.createOrganization({ slug });

      const found = await ctx.prisma.organization.findUnique({
        where: { slug },
      });

      expect(found).not.toBeNull();
      expect(found?.id).toBe(org.id);
    });

    test("returns null for non-existent slug", async () => {
      const found = await ctx.prisma.organization.findUnique({
        where: { slug: "non-existent-slug" },
      });

      expect(found).toBeNull();
    });
  });

  describe("organization updates", () => {
    test("updates organization name", async () => {
      const org = await ctx.createOrganization();
      const newName = "Updated Name";

      const updated = await ctx.prisma.organization.update({
        where: { id: org.id },
        data: { name: newName },
      });

      expect(updated.name).toBe(newName);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        org.updatedAt.getTime(),
      );
    });

    test("updates organization slug", async () => {
      const org = await ctx.createOrganization();
      const newSlug = `${ctx.prefix}updated-slug`;

      const updated = await ctx.prisma.organization.update({
        where: { id: org.id },
        data: { slug: newSlug },
      });

      expect(updated.slug).toBe(newSlug);
    });
  });
});

describe("organization membership", () => {
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

  describe("createMembership", () => {
    test("creates a membership with default role", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();

      const membership = await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
      });

      expect(membership.id).toBeDefined();
      expect(membership.userId).toBe(user.id);
      expect(membership.organizationId).toBe(org.id);
      expect(membership.role).toBe("member");
    });

    test("creates a membership with specified role", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();

      const membership = await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
        role: "owner",
      });

      expect(membership.role).toBe("owner");
    });

    test("creates admin membership", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();

      const membership = await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
        role: "admin",
      });

      expect(membership.role).toBe("admin");
    });
  });

  describe("membership uniqueness", () => {
    test("prevents duplicate user-org memberships", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();

      await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
      });

      await expect(
        ctx.createMembership({
          userId: user.id,
          organizationId: org.id,
        }),
      ).rejects.toThrow();
    });

    test("allows same user in different organizations", async () => {
      const user = await ctx.createUser();
      const org1 = await ctx.createOrganization();
      const org2 = await ctx.createOrganization();

      const membership1 = await ctx.createMembership({
        userId: user.id,
        organizationId: org1.id,
      });
      const membership2 = await ctx.createMembership({
        userId: user.id,
        organizationId: org2.id,
      });

      expect(membership1.id).not.toBe(membership2.id);
    });

    test("allows different users in same organization", async () => {
      const user1 = await ctx.createUser();
      const user2 = await ctx.createUser();
      const org = await ctx.createOrganization();

      const membership1 = await ctx.createMembership({
        userId: user1.id,
        organizationId: org.id,
      });
      const membership2 = await ctx.createMembership({
        userId: user2.id,
        organizationId: org.id,
      });

      expect(membership1.id).not.toBe(membership2.id);
    });
  });

  describe("membership queries", () => {
    test("finds all members of an organization", async () => {
      const org = await ctx.createOrganization();
      const user1 = await ctx.createUser();
      const user2 = await ctx.createUser();
      const user3 = await ctx.createUser();

      await ctx.createMembership({
        userId: user1.id,
        organizationId: org.id,
        role: "owner",
      });
      await ctx.createMembership({
        userId: user2.id,
        organizationId: org.id,
        role: "admin",
      });
      await ctx.createMembership({
        userId: user3.id,
        organizationId: org.id,
        role: "member",
      });

      const members = await ctx.prisma.organizationMember.findMany({
        where: { organizationId: org.id },
        include: { user: true },
      });

      expect(members).toHaveLength(3);
    });

    test("finds all organizations for a user", async () => {
      const user = await ctx.createUser();
      const org1 = await ctx.createOrganization();
      const org2 = await ctx.createOrganization();
      const org3 = await ctx.createOrganization();

      await ctx.createMembership({ userId: user.id, organizationId: org1.id });
      await ctx.createMembership({ userId: user.id, organizationId: org2.id });
      await ctx.createMembership({ userId: user.id, organizationId: org3.id });

      const memberships = await ctx.prisma.organizationMember.findMany({
        where: { userId: user.id },
        include: { organization: true },
      });

      expect(memberships).toHaveLength(3);
    });

    test("finds members by role", async () => {
      const org = await ctx.createOrganization();
      await ctx.createMembership({
        userId: (await ctx.createUser()).id,
        organizationId: org.id,
        role: "owner",
      });
      await ctx.createMembership({
        userId: (await ctx.createUser()).id,
        organizationId: org.id,
        role: "admin",
      });
      await ctx.createMembership({
        userId: (await ctx.createUser()).id,
        organizationId: org.id,
        role: "member",
      });
      await ctx.createMembership({
        userId: (await ctx.createUser()).id,
        organizationId: org.id,
        role: "member",
      });

      const admins = await ctx.prisma.organizationMember.findMany({
        where: {
          organizationId: org.id,
          role: { in: ["owner", "admin"] },
        },
      });

      expect(admins).toHaveLength(2);
    });
  });

  describe("membership updates", () => {
    test("updates member role", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();
      const membership = await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
        role: "member",
      });

      const updated = await ctx.prisma.organizationMember.update({
        where: { id: membership.id },
        data: { role: "admin" },
      });

      expect(updated.role).toBe("admin");
    });
  });

  describe("membership cascade deletion", () => {
    test("memberships are deleted when user is deleted", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();
      const membership = await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
      });

      await ctx.prisma.user.delete({ where: { id: user.id } });
      ctx.userIds.delete(user.id);
      ctx.membershipIds.delete(membership.id);

      const found = await ctx.prisma.organizationMember.findUnique({
        where: { id: membership.id },
      });
      expect(found).toBeNull();
    });

    test("memberships are deleted when organization is deleted", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();
      const membership = await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
      });

      await ctx.prisma.organization.delete({ where: { id: org.id } });
      ctx.organizationIds.delete(org.id);
      ctx.membershipIds.delete(membership.id);

      const found = await ctx.prisma.organizationMember.findUnique({
        where: { id: membership.id },
      });
      expect(found).toBeNull();
    });
  });
});

describe("createUserWithOrg convenience method", () => {
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

  test("creates user, organization, and membership together", async () => {
    const result = await ctx.createUserWithOrg();

    expect(result.user.id).toBeDefined();
    expect(result.organization.id).toBeDefined();
    expect(result.membership.id).toBeDefined();

    expect(result.membership.userId).toBe(result.user.id);
    expect(result.membership.organizationId).toBe(result.organization.id);
    expect(result.membership.role).toBe("owner");
  });

  test("creates user as owner by default", async () => {
    const { membership } = await ctx.createUserWithOrg();

    expect(membership.role).toBe("owner");
  });

  test("accepts custom role", async () => {
    const { membership } = await ctx.createUserWithOrg({ role: "admin" });

    expect(membership.role).toBe("admin");
  });

  test("accepts custom email and password", async () => {
    const email = `${ctx.prefix}custom@test.local`;
    const password = "CustomPass123";

    const { user } = await ctx.createUserWithOrg({ email, password });

    expect(user.email).toBe(email);
  });

  test("accepts custom org name", async () => {
    const orgName = "Custom Org Name";

    const { organization } = await ctx.createUserWithOrg({ orgName });

    expect(organization.name).toBe(orgName);
  });
});
