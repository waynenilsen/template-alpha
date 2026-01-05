import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { TRPCError } from "@trpc/server";
import {
  createMockSessionFromUserWithOrg,
  createTestContext,
  disconnectTestPrisma,
  mockSession,
  type TestContext,
  unmockSession,
} from "../../test/harness";
import { tmid } from "../tmid";
import { auth } from "./auth";
import { orgContext } from "./org";

describe("orgContext middleware", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    unmockSession();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  test("allows requests with valid organization context", async () => {
    const { user, organization, membership } = await ctx.createUserWithOrg();
    const session = await ctx.createSession({
      userId: user.id,
      currentOrgId: organization.id,
    });

    mockSession(createMockSessionFromUserWithOrg(session, user));

    const result = await tmid()
      .use(auth())
      .use(orgContext())
      .build(async (context) => {
        return {
          organizationId: context.organizationId,
          membershipRole: context.membership?.role,
        };
      });

    expect(result.organizationId).toBe(organization.id);
    expect(result.membershipRole).toBe(membership.role);
  });

  test("throws FORBIDDEN when no organization is selected", async () => {
    const user = await ctx.createUser();
    const session = await ctx.createSession({
      userId: user.id,
      // No currentOrgId
    });

    mockSession(createMockSessionFromUserWithOrg(session, user));

    try {
      await tmid()
        .use(auth())
        .use(orgContext())
        .build(async () => {
          return "should not reach";
        });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("FORBIDDEN");
      expect((error as TRPCError).message).toBe(
        "You must select an organization to access this resource",
      );
    }
  });

  test("throws FORBIDDEN when user is not a member of the organization", async () => {
    const user = await ctx.createUser();
    const organization = await ctx.createOrganization();
    // User is NOT a member of this organization
    const session = await ctx.createSession({
      userId: user.id,
      currentOrgId: organization.id,
    });

    mockSession(createMockSessionFromUserWithOrg(session, user));

    try {
      await tmid()
        .use(auth())
        .use(orgContext())
        .build(async () => {
          return "should not reach";
        });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("FORBIDDEN");
      expect((error as TRPCError).message).toBe(
        "You are not a member of this organization",
      );
    }
  });

  test("allows internal admin to access any organization", async () => {
    const admin = await ctx.createUser({ isAdmin: true });
    const organization = await ctx.createOrganization();
    // Admin is NOT a member, but isAdmin = true
    const session = await ctx.createSession({
      userId: admin.id,
      currentOrgId: organization.id,
    });

    mockSession(createMockSessionFromUserWithOrg(session, admin));

    const result = await tmid()
      .use(auth())
      .use(orgContext())
      .build(async (context) => {
        return {
          organizationId: context.organizationId,
          membership: context.membership,
        };
      });

    expect(result.organizationId).toBe(organization.id);
    expect(result.membership).toBeNull(); // Admin has no membership but is allowed
  });

  test("includes organization data in membership", async () => {
    const { user, organization } = await ctx.createUserWithOrg();
    const session = await ctx.createSession({
      userId: user.id,
      currentOrgId: organization.id,
    });

    mockSession(createMockSessionFromUserWithOrg(session, user));

    const result = await tmid()
      .use(auth())
      .use(orgContext())
      .build(async (context) => {
        return {
          organizationId: context.organizationId,
          organizationName: context.membership?.organization.name,
          organizationSlug: context.membership?.organization.slug,
        };
      });

    expect(result.organizationId).toBe(organization.id);
    expect(result.organizationName).toBe(organization.name);
    expect(result.organizationSlug).toBe(organization.slug);
  });
});
