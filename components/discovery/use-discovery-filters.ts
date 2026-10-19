"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  parseDiscoveryParams,
  serializeDiscoveryParams,
  type DiscoveryFilters,
} from "@/lib/discovery/discovery-params";

/** Discovery filters backed by the URL so searches are shareable and survive reloads. */
export function useDiscoveryFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const query = searchParams.toString();
  const filters = useMemo(
    () => parseDiscoveryParams(new URLSearchParams(query)),
    [query],
  );

  const setFilters = useCallback(
    (next: DiscoveryFilters) => {
      const serialized = serializeDiscoveryParams(next);
      router.push(serialized ? `${pathname}?${serialized}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const updateFilters = useCallback(
    (patch: Partial<DiscoveryFilters>) => setFilters({ ...filters, ...patch }),
    [filters, setFilters],
  );

  return { filters, setFilters, updateFilters };
}
