import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    // Apollo Server v4 requires context: ({req, res}) => ({req, res}) in GraphQLModule;
    // stub res so the guard degrades gracefully even if res is absent.
    const res = ctx.res ?? { header: () => {}, setHeader: () => {} };
    return { req: ctx.req, res };
  }
}
