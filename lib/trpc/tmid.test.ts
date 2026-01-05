import { describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import type { TRPCBaseContext } from "./tmid";
import { tmid } from "./tmid";

describe("tmid middleware builder", () => {
  describe("build", () => {
    test("executes handler without middleware", async () => {
      const result = await tmid().build(async () => {
        return "hello";
      });

      expect(result).toBe("hello");
    });

    test("passes empty context to handler when no middleware", async () => {
      const result = await tmid().build(async (ctx) => {
        return ctx;
      });

      expect(result).toEqual({});
    });

    test("executes single middleware and handler", async () => {
      function addValue<TContext extends TRPCBaseContext, TResult>() {
        return async (
          ctx: TContext,
          next: (ctx: TContext & { value: number }) => Promise<TResult>,
        ) => next({ ...ctx, value: 42 });
      }

      const result = await tmid()
        .use(addValue())
        .build(async (ctx) => {
          return ctx.value;
        });

      expect(result).toBe(42);
    });

    test("chains multiple middlewares in order", async () => {
      const order: number[] = [];

      function addFirst<TContext extends TRPCBaseContext, TResult>() {
        return async (
          ctx: TContext,
          next: (ctx: TContext & { first: string }) => Promise<TResult>,
        ) => {
          order.push(1);
          const result = await next({ ...ctx, first: "a" });
          order.push(4);
          return result;
        };
      }

      function addSecond<TContext extends TRPCBaseContext, TResult>() {
        return async (
          ctx: TContext,
          next: (ctx: TContext & { second: string }) => Promise<TResult>,
        ) => {
          order.push(2);
          const result = await next({ ...ctx, second: "b" });
          order.push(3);
          return result;
        };
      }

      const result = await tmid()
        .use(addFirst())
        .use(addSecond())
        .build(async (ctx) => {
          return { first: ctx.first, second: ctx.second };
        });

      expect(result).toEqual({ first: "a", second: "b" });
      expect(order).toEqual([1, 2, 3, 4]);
    });

    test("middleware can short-circuit by not calling next", async () => {
      let handlerCalled = false;

      function shortCircuit<TContext extends TRPCBaseContext, TResult>() {
        return async (
          _ctx: TContext,
          _next: (ctx: TContext) => Promise<TResult>,
        ): Promise<string> => {
          return "short-circuited";
        };
      }

      const result = await tmid()
        .use(shortCircuit())
        .build(async () => {
          handlerCalled = true;
          return "handler result";
        });

      expect(result).toBe("short-circuited");
      expect(handlerCalled).toBe(false);
    });

    test("throws TRPCError when next() called multiple times", async () => {
      function doubleNext<TContext extends TRPCBaseContext, TResult>() {
        return async (
          _ctx: TContext,
          next: (ctx: TContext) => Promise<TResult>,
        ) => {
          await next({} as TContext);
          await next({} as TContext); // Second call should throw
          return "result" as TResult;
        };
      }

      try {
        await tmid()
          .use(doubleNext())
          .build(async () => {
            return "handler";
          });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
        expect((error as TRPCError).message).toBe(
          "next() called multiple times",
        );
      }
    });

    test("middleware can transform handler result", async () => {
      function doubler<TContext extends TRPCBaseContext, TResult>() {
        return async (
          _ctx: TContext,
          next: (ctx: TContext) => Promise<TResult>,
        ): Promise<unknown> => {
          const value = (await next({} as TContext)) as number;
          return value * 2;
        };
      }

      const result = await tmid()
        .use(doubler())
        .build(async () => {
          return 21;
        });

      expect(result).toBe(42);
    });

    test("middleware can catch and handle errors", async () => {
      function errorCatcher<TContext extends TRPCBaseContext, TResult>() {
        return async (
          _ctx: TContext,
          next: (ctx: TContext) => Promise<TResult>,
        ): Promise<unknown> => {
          try {
            await next({} as TContext);
            return "success";
          } catch {
            return "caught error";
          }
        };
      }

      const result = await tmid()
        .use(errorCatcher())
        .build(async (): Promise<string> => {
          throw new Error("handler error");
        });

      expect(result).toBe("caught error");
    });

    test("TRPCError propagates through middleware chain", async () => {
      function passthrough<TContext extends TRPCBaseContext, TResult>() {
        return async (
          _ctx: TContext,
          next: (ctx: TContext) => Promise<TResult>,
        ) => {
          return next({} as TContext);
        };
      }

      try {
        await tmid()
          .use(passthrough())
          .build(async () => {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Access denied",
            });
          });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
        expect((error as TRPCError).message).toBe("Access denied");
      }
    });

    test("accumulates context through middleware chain", async () => {
      interface Ctx1 extends TRPCBaseContext {
        userId: string;
      }
      interface Ctx2 extends Ctx1 {
        orgId: string;
      }
      interface Ctx3 extends Ctx2 {
        role: string;
      }

      function addUserId<TContext extends TRPCBaseContext, TResult>() {
        return async (
          ctx: TContext,
          next: (ctx: TContext & { userId: string }) => Promise<TResult>,
        ) => next({ ...ctx, userId: "user-123" });
      }

      function addOrgId<TContext extends Ctx1, TResult>() {
        return async (
          ctx: TContext,
          next: (ctx: TContext & { orgId: string }) => Promise<TResult>,
        ) => next({ ...ctx, orgId: "org-456" });
      }

      function addRole<TContext extends Ctx2, TResult>() {
        return async (
          ctx: TContext,
          next: (ctx: TContext & { role: string }) => Promise<TResult>,
        ) => next({ ...ctx, role: "admin" });
      }

      const result = await tmid()
        .use(addUserId())
        .use(addOrgId())
        .use(addRole())
        .build(async (ctx: Ctx3) => {
          return {
            userId: ctx.userId,
            orgId: ctx.orgId,
            role: ctx.role,
          };
        });

      expect(result).toEqual({
        userId: "user-123",
        orgId: "org-456",
        role: "admin",
      });
    });
  });

  describe("buildGenerator", () => {
    test("yields values from async generator", async () => {
      const values: number[] = [];

      const generator = tmid().buildGenerator(async function* () {
        yield 1;
        yield 2;
        yield 3;
      });

      for await (const value of generator) {
        values.push(value);
      }

      expect(values).toEqual([1, 2, 3]);
    });

    test("provides context to generator", async () => {
      const values: string[] = [];

      function addPrefix<TContext extends TRPCBaseContext, TResult>() {
        return async (
          ctx: TContext,
          next: (ctx: TContext & { prefix: string }) => Promise<TResult>,
        ) => next({ ...ctx, prefix: "item-" });
      }

      const generator = tmid()
        .use(addPrefix())
        .buildGenerator(async function* (ctx) {
          yield `${ctx.prefix}1`;
          yield `${ctx.prefix}2`;
        });

      for await (const value of generator) {
        values.push(value);
      }

      expect(values).toEqual(["item-1", "item-2"]);
    });
  });
});
