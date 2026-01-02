/**
 * Organization factory for test harness
 */

import type {
  Organization,
  PrismaClient,
} from "../../../generated/prisma/client";
import type { CreateOrganizationOptions } from "../types";
import { generateUniqueId } from "../utils";

export function createOrganizationFactory(
  prisma: PrismaClient,
  prefix: string,
  organizationIds: Set<string>,
) {
  return async (
    options: CreateOrganizationOptions = {},
  ): Promise<Organization> => {
    const uniqueId = generateUniqueId();
    const name = options.name ?? `${prefix}Org ${uniqueId}`;
    const slug = options.slug ?? `${prefix}org-${uniqueId}`;

    const organization = await prisma.organization.create({
      data: { name, slug },
    });

    organizationIds.add(organization.id);
    return organization;
  };
}
