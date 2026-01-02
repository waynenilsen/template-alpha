import "server-only";

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { createCallerFactory, createServerSideContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./router";

/**
 * Create a server-side caller for direct procedure invocation
 * Use this when you need to call procedures from server components
 * without going through HTTP
 */
const createCaller = createCallerFactory(appRouter);

/**
 * Get a request-scoped query client using React's cache()
 */
export const getQueryClient = cache(makeQueryClient);

/**
 * Create a request-scoped tRPC caller for direct server-side calls
 */
export const caller = cache(async () => {
  const ctx = await createServerSideContext();
  return createCaller(ctx);
});

/**
 * Create tRPC options proxy for server-side prefetching
 * This enables the "render as you fetch" pattern with queryOptions
 */
export const trpc = createTRPCOptionsProxy<typeof appRouter>({
  ctx: createServerSideContext,
  router: appRouter,
  queryClient: getQueryClient,
});
