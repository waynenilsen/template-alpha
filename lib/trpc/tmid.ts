import { TRPCError } from "@trpc/server";

// Base type for middleware functions in TRPC
type TRPCMiddlewareFunction<
  TInputContext,
  TOutputContext,
  TResult = unknown,
> = (
  context: TInputContext,
  next: (context: TOutputContext) => Promise<TResult>,
) => Promise<TResult>;

export type TRPCBaseContext = object;

class TRPCMiddlewareBuilder<TCurrentContext extends TRPCBaseContext> {
  private middlewares: Array<
    TRPCMiddlewareFunction<unknown, unknown, unknown>
  > = [];

  use<TNewContext extends TCurrentContext>(
    middleware: TRPCMiddlewareFunction<TCurrentContext, TNewContext, unknown>,
  ): TRPCMiddlewareBuilder<TNewContext> {
    this.middlewares.push(
      middleware as TRPCMiddlewareFunction<unknown, unknown, unknown>,
    );
    return this as unknown as TRPCMiddlewareBuilder<TNewContext>;
  }

  build<TResult>(
    handler: (context: TCurrentContext) => Promise<TResult>,
  ): Promise<TResult> {
    let index = -1;

    const dispatch = async (
      currentIndex: number,
      currentContext: TRPCBaseContext,
    ): Promise<TResult> => {
      if (currentIndex <= index) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "next() called multiple times",
        });
      }
      index = currentIndex;

      if (currentIndex === this.middlewares.length) {
        // Base case: Call the final handler
        return handler(currentContext as TCurrentContext);
      }

      // Get the current middleware
      const middleware = this.middlewares[
        currentIndex
        // biome-ignore lint/suspicious/noExplicitAny: required for middleware chain
      ] as TRPCMiddlewareFunction<any, any>;

      if (!middleware) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Middleware not found at index ${currentIndex}`,
        });
      }

      // Define the 'next' function for the current middleware
      // biome-ignore lint/suspicious/noExplicitAny: required for middleware chain
      const next = (nextContext: any): Promise<TResult> => {
        return dispatch(currentIndex + 1, nextContext);
      };

      // Call the current middleware
      return middleware(currentContext, next) as Promise<TResult>;
    };

    // Start the middleware chain with the initial TRPC context
    return dispatch(0, {});
  }

  async *buildGenerator<TResult>(
    handler: (context: TCurrentContext) => AsyncGenerator<TResult>,
  ): AsyncGenerator<TResult> {
    // First run through all middlewares to get the final context
    let finalContext: TCurrentContext = {} as TCurrentContext;

    await this.build(async (context) => {
      finalContext = context;
      return undefined;
    });

    // Now use the authenticated context with the generator
    yield* handler(finalContext);
  }
}

// Factory function to create a new middleware builder
export function tmid(): TRPCMiddlewareBuilder<object> {
  return new TRPCMiddlewareBuilder<object>();
}
