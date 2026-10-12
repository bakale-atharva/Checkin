"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";

import { api } from "@/convex/_generated/api";

export function ProfileBootstrap() {
  const { isAuthenticated } = useConvexAuth();
  const bootstrapProfile = useMutation(api.users.bootstrapProfile);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void bootstrapProfile();
  }, [bootstrapProfile, isAuthenticated]);

  return null;
}
