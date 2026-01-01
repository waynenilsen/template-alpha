import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

/**
 * Create a new QueryClient instance with tRPC-optimized defaults
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we don't want to retry on the client immediately
        staleTime: 30 * 1000,
      },
      dehydrate: {
        // Use superjson for serializing Date, Map, Set, etc.
        serializeData: superjson.serialize,
        // Include pending queries for streaming SSR
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        // Use superjson for deserializing
        deserializeData: superjson.deserialize,
      },
    },
  });
}

let clientQueryClient: QueryClient | undefined;

/**
 * Get or create a QueryClient instance
 * - Server: Always creates a new instance (request-scoped)
 * - Client: Reuses a singleton instance
 */
export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Client: make a new query client if we don't already have one
  if (!clientQueryClient) {
    clientQueryClient = makeQueryClient();
  }
  return clientQueryClient;
}
