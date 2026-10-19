"use client";

import { useClerk } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, Heart, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const DEFAULT_WISHLIST_NAME = "Saved stays";

function messageOf(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "object") {
    const message = (error.data as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Couldn't update your wishlist. Try again.";
}

export function WishlistButton({
  listingId,
  listingTitle,
  saved,
  className,
}: {
  listingId: Id<"listings">;
  listingTitle: string;
  saved: boolean;
  className?: string;
}) {
  const { isAuthenticated } = useConvexAuth();
  const clerk = useClerk();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={
          saved
            ? `Saved: ${listingTitle}. Edit wishlists`
            : `Save ${listingTitle} to a wishlist`
        }
        aria-expanded={isAuthenticated ? open : undefined}
        aria-haspopup={isAuthenticated ? "dialog" : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!isAuthenticated) {
            clerk.openSignIn();
            return;
          }
          setOpen((value) => !value);
        }}
        className="grid size-11 place-items-center rounded-full bg-checkin-paper/85 text-checkin-ink shadow-[0_4px_14px_rgb(23_35_31/0.18)] backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/50"
      >
        <Heart
          aria-hidden
          className={cn(
            "size-5",
            saved
              ? "fill-checkin-signal text-checkin-signal"
              : "fill-transparent",
          )}
        />
      </button>
      {open ? (
        <WishlistPanel
          listingId={listingId}
          listingTitle={listingTitle}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function WishlistPanel({
  listingId,
  listingTitle,
  onDone,
}: {
  listingId: Id<"listings">;
  listingTitle: string;
  onDone: () => void;
}) {
  const id = useId();
  const wishlists = useQuery(api.dashboard.listingWishlists, { listingId });
  const addItem = useMutation(api.dashboard.addWishlistItem);
  const removeItem = useMutation(api.dashboard.removeWishlistItem);
  const createWishlist = useMutation(api.dashboard.createWishlist);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(undefined);
    try {
      await action();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(undefined);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim() || DEFAULT_WISHLIST_NAME;
    await run("create", async () => {
      const wishlistId = await createWishlist({ name: trimmed });
      await addItem({ wishlistId, listingId });
      setName("");
    });
  }

  return (
    <div
      role="dialog"
      aria-labelledby={`${id}-title`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      className="absolute right-0 top-full z-30 mt-2 w-72 rounded-[1rem] border border-checkin-line bg-checkin-paper p-3 text-left text-checkin-ink shadow-[0_18px_45px_rgb(23_35_31/0.2)]"
    >
      <h3 id={`${id}-title`} className="px-1 text-sm font-semibold">
        Save to a wishlist
      </h3>
      <p className="truncate px-1 text-xs text-checkin-muted">{listingTitle}</p>

      {wishlists === undefined ? (
        <p className="px-1 py-4 text-sm text-checkin-muted">
          Loading wishlists…
        </p>
      ) : wishlists.length > 0 ? (
        <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
          {wishlists.map((wishlist) => (
            <li key={wishlist.wishlistId}>
              <button
                type="button"
                aria-pressed={wishlist.containsListing}
                disabled={busy !== undefined}
                onClick={() =>
                  run(wishlist.wishlistId, () =>
                    wishlist.containsListing
                      ? removeItem({
                          wishlistId: wishlist.wishlistId,
                          listingId,
                        })
                      : addItem({ wishlistId: wishlist.wishlistId, listingId }),
                  )
                }
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[0.7rem] px-2.5 text-sm font-medium hover:bg-checkin-mist/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 disabled:opacity-60"
              >
                <span className="truncate">{wishlist.name}</span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-[0.35rem] border",
                    wishlist.containsListing
                      ? "border-checkin-ink bg-checkin-ink text-checkin-canvas"
                      : "border-checkin-line",
                  )}
                >
                  {wishlist.containsListing ? (
                    <Check className="size-3.5" />
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-3 text-sm text-checkin-muted">
          Wishlists keep the stays you want to compare. Start one below.
        </p>
      )}

      <form
        onSubmit={create}
        className="mt-2 flex gap-2 border-t border-checkin-line pt-3"
      >
        <label htmlFor={`${id}-name`} className="sr-only">
          New wishlist name
        </label>
        <input
          id={`${id}-name`}
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder={
            wishlists?.length ? "New wishlist" : DEFAULT_WISHLIST_NAME
          }
          className="min-h-11 min-w-0 flex-1 rounded-[0.7rem] border border-checkin-line bg-transparent px-3 text-sm outline-none focus:border-checkin-ink"
        />
        <button
          type="submit"
          aria-label="Create wishlist and save"
          disabled={busy !== undefined}
          className="grid size-11 shrink-0 place-items-center rounded-[0.7rem] bg-checkin-ink text-checkin-canvas hover:bg-checkin-ink/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 disabled:opacity-60"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 px-1 text-xs text-checkin-signal">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onDone}
        className="mt-2 min-h-9 w-full rounded-[0.7rem] text-xs font-semibold text-checkin-muted hover:text-checkin-ink"
      >
        Done
      </button>
    </div>
  );
}
