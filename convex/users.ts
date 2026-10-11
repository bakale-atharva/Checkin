import { v } from "convex/values";

import { profileFieldsFromIdentity } from "../lib/auth/profile";
import { requireIdentity } from "./auth";
import { mutation, query } from "./_generated/server";

const profileValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  tokenIdentifier: v.string(),
  clerkUserId: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function profileFields(identity: {
  tokenIdentifier: string;
  subject: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
}) {
  const profile = profileFieldsFromIdentity(identity);

  return {
    tokenIdentifier: profile.tokenIdentifier,
    clerkUserId: profile.clerkUserId,
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.name ? { name: profile.name } : {}),
    ...(profile.imageUrl ? { imageUrl: profile.imageUrl } : {}),
  };
}

export const bootstrapProfile = mutation({
  args: {},
  returns: profileValidator,
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const fields = profileFields(identity);
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, updatedAt: now });
      return { ...existing, ...fields, updatedAt: now };
    }

    const userId = await ctx.db.insert("users", {
      ...fields,
      createdAt: now,
      updatedAt: now,
    });

    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("Profile creation failed unexpectedly.");
    }

    return user;
  },
});

export const currentProfile = query({
  args: {},
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);

    return await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});
