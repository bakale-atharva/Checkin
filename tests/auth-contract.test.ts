import assert from "node:assert/strict";
import test from "node:test";
import { ConvexError } from "convex/values";

import { assertProfileOwner } from "../convex/auth";
import type { Id } from "../convex/_generated/dataModel";
import {
  AuthorizationErrorCode,
  assertOwner,
  authorizationError,
} from "../lib/auth/authorization";
import {
  profileFieldsFromIdentity,
  shouldBootstrapProfile,
} from "../lib/auth/profile";

test("projects only stable, safe profile fields from an authenticated identity", () => {
  assert.deepEqual(
    profileFieldsFromIdentity({
      tokenIdentifier: "https://clerk.example|user_123",
      subject: "user_123",
      email: "guest@example.com",
      name: "Guest User",
      pictureUrl: "https://images.example/guest.png",
    }),
    {
      tokenIdentifier: "https://clerk.example|user_123",
      clerkUserId: "user_123",
      email: "guest@example.com",
      name: "Guest User",
      imageUrl: "https://images.example/guest.png",
    },
  );
});

test("retains a usable profile when Clerk optional claims are absent", () => {
  assert.deepEqual(
    profileFieldsFromIdentity({
      tokenIdentifier: "https://clerk.example|user_123",
      subject: "user_123",
    }),
    {
      tokenIdentifier: "https://clerk.example|user_123",
      clerkUserId: "user_123",
      email: undefined,
      name: undefined,
      imageUrl: undefined,
    },
  );
});

test("uses stable machine-readable codes for authentication and ownership failures", () => {
  assert.deepEqual(authorizationError(AuthorizationErrorCode.Unauthenticated), {
    code: "UNAUTHENTICATED",
    message: "You must be signed in to perform this action.",
  });
  assert.deepEqual(authorizationError(AuthorizationErrorCode.Forbidden), {
    code: "FORBIDDEN",
    message: "You do not have permission to perform this action.",
  });
});

test("rejects a cross-account ownership check with a typed forbidden error", () => {
  assert.throws(
    () => assertOwner("profile_owner", "profile_other"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "You do not have permission to perform this action.",
  );
});

test("returns a structured Convex forbidden error for cross-profile access", () => {
  assert.throws(
    () =>
      assertProfileOwner(
        "profile_owner" as Id<"users">,
        "profile_other" as Id<"users">,
      ),
    (error: unknown) => {
      assert.ok(error instanceof ConvexError);
      assert.deepEqual(error.data, {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
      return true;
    },
  );
});

test("only bootstraps a profile after Convex confirms the session is authenticated", () => {
  assert.equal(shouldBootstrapProfile(false), false);
  assert.equal(shouldBootstrapProfile(true), true);
});
