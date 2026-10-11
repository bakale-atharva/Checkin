"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";

import { api } from "@/convex/_generated/api";
import { shouldBootstrapProfile } from "@/lib/auth/profile";

export function ProfileBootstrap() {
  const { isAuthenticated } = useConvexAuth();
  const bootstrapProfile = useMutation(api.users.bootstrapProfile);

  useEffect(() => {
    if (!shouldBootstrapProfile(isAuthenticated)) {
      return;
    }

    void bootstrapProfile();
  }, [bootstrapProfile, isAuthenticated]);

  return null;
}
