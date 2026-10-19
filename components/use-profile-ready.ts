"use client";

import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

/**
 * True once the signed-in user's Checkin profile exists. `ProfileBootstrap`
 * creates it just after sign-in, so queries that require a profile must wait
 * for this rather than for Clerk authentication alone.
 */
export function useProfileReady() {
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.users.currentProfile,
    isAuthenticated ? {} : "skip",
  );
  return isAuthenticated && profile != null;
}
