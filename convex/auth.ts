import { ConvexError } from "convex/values";

import {
  AuthorizationErrorCode,
  authorizationError,
} from "../lib/auth/authorization";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type AuthenticatedContext = Pick<QueryCtx | MutationCtx, "auth">;

export async function requireIdentity(ctx: AuthenticatedContext) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError(
      authorizationError(AuthorizationErrorCode.Unauthenticated),
    );
  }

  return identity;
}

type ProfileContext = Pick<QueryCtx | MutationCtx, "auth" | "db">;

export async function requireProfile(ctx: ProfileContext): Promise<Doc<"users">> {
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
