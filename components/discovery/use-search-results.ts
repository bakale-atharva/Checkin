"use client";

import { useMutation, useQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  SEARCH_PAGE_SIZE,
  type SearchInput,
} from "@/lib/search/search-contract";

export type SearchResult = FunctionReturnType<
  typeof api.search.page
>["page"][number];

type Snapshot = { key: string; attempt: number } & (
  | { status: "ready"; snapshotId: Id<"searchSnapshots">; total: number }
  | { status: "error"; code: string; message: string }
);

export type SearchResultsState = {
  status: "loading" | "ready" | "error";
  results: SearchResult[];
  total: number;
  error?: { code: string; message: string };
  canLoadMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

function errorDetails(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "object") {
    const data = error.data as { code?: unknown; message?: unknown };
    if (typeof data.code === "string") {
      return {
        code: data.code,
        message:
          typeof data.message === "string"
            ? data.message
            : "Search failed. Try again.",
      };
    }
  }
  return {
    code: "SEARCH_UNAVAILABLE",
    message:
      "Search is temporarily unavailable. Check your connection and try again.",
  };
}

/**
 * Runs the backend search contract: one short-lived snapshot per filter set,
 * then pages of 24 loaded on demand. Expired snapshots are recreated with the
 * same filters, keeping the pages already loaded.
 */
export function useSearchResults(input: SearchInput): SearchResultsState {
  const key = JSON.stringify(input);
  const createSnapshot = useMutation(api.search.createSnapshot);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [pageCount, setPageCount] = useState({ key, count: 1 });
  const [attempt, setAttempt] = useState(0);

  const current = snapshot?.key === key ? snapshot : undefined;
  const pages = pageCount.key === key ? pageCount.count : 1;
  const snapshotId =
    current?.status === "ready" ? current.snapshotId : undefined;

  const requests = useMemo(() => {
    if (!snapshotId) return {};
    return Object.fromEntries(
      Array.from({ length: pages }, (_, index) => [
        String(index),
        {
          query: api.search.page,
          args: { snapshotId, offset: index * SEARCH_PAGE_SIZE },
        },
      ]),
    );
  }, [snapshotId, pages]);
  const responses = useQueries(requests);

  const pageResults: Array<
    FunctionReturnType<typeof api.search.page> | Error | undefined
  > = Array.from(
    { length: snapshotId ? pages : 0 },
    (_, index) => responses[String(index)],
  );
  const pageError = pageResults.find((value) => value instanceof Error);
  const expired =
    pageError !== undefined &&
    errorDetails(pageError).code === "SEARCH_SNAPSHOT_EXPIRED";

  // A new snapshot is needed for new filters, a retry, or when the current
  // snapshot's scheduled cleanup has invalidated its pages.
  const expiredSnapshotId = expired ? snapshotId : undefined;
  useEffect(() => {
    const needed =
      snapshot === undefined ||
      snapshot.key !== key ||
      snapshot.attempt !== attempt ||
      expiredSnapshotId !== undefined;
    if (!needed) return;
    let cancelled = false;
    createSnapshot(JSON.parse(key) as SearchInput)
      .then((created) => {
        if (!cancelled)
          setSnapshot({
            key,
            attempt,
            status: "ready",
            snapshotId: created.snapshotId,
            total: created.total,
          });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setSnapshot({
            key,
            attempt,
            status: "error",
            ...errorDetails(error),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [createSnapshot, key, attempt, expiredSnapshotId, snapshot]);

  const loaded: SearchResult[] = [];
  let pending = false;
  for (const value of pageResults) {
    if (value === undefined) {
      pending = true;
      break;
    }
    if (value instanceof Error) break;
    loaded.push(...value.page);
  }

  const firstPagePending =
    !current ||
    (snapshotId !== undefined && pageResults[0] === undefined) ||
    expired;
  const results = expired ? [] : loaded;

  const lastPage = pageResults.at(-1);
  const isDone =
    lastPage !== undefined && !(lastPage instanceof Error) && lastPage.isDone;

  const loadMore = useCallback(() => {
    setPageCount((value) => ({
      key,
      count: (value.key === key ? value.count : 1) + 1,
    }));
  }, [key]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  if (current?.status === "error") {
    return {
      status: "error",
      results: [],
      total: 0,
      error: { code: current.code, message: current.message },
      canLoadMore: false,
      isLoadingMore: false,
      loadMore,
      retry,
    };
  }
  if (pageError && !expired) {
    return {
      status: "error",
      results,
      total: current?.status === "ready" ? current.total : 0,
      error: errorDetails(pageError),
      canLoadMore: false,
      isLoadingMore: false,
      loadMore,
      retry,
    };
  }
  return {
    status: firstPagePending ? "loading" : "ready",
    results,
    total: current?.status === "ready" ? current.total : 0,
    canLoadMore: !firstPagePending && !pending && !isDone,
    isLoadingMore: !firstPagePending && pending,
    loadMore,
    retry,
  };
}
