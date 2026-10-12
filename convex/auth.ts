import { ConvexError } from "convex/values";

import {
  AuthorizationErrorCode,
  authorizationError,
} from "../lib/auth/authorization";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError(
      authorizationError(AuthorizationErrorCode.Unauthenticated),
    );
  }

  return identity;
}

export async function requireProfile(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx);
  const profile = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!profile) {
    throw new ConvexError(
      authorizationError(AuthorizationErrorCode.ProfileNotFound),
    );
  }

  return profile;
}

export function assertProfileOwner(
  ownerProfileId: Id<"users">,
  actorProfileId: Id<"users">,
) {
  if (ownerProfileId !== actorProfileId) {
    throw new ConvexError(authorizationError(AuthorizationErrorCode.Forbidden));
  }
}
