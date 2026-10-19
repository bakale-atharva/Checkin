"use client";

import { useMutation, useQuery } from "convex/react";
import { Heart, Plus } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type WishlistSummary = {
  _id: Id<"wishlists">;
  name: string;
  itemCount: number;
};

export function WishlistsOverview() {
  const profileReady = useProfileReady();
  const wishlists = useQuery(
    api.dashboard.listWishlists,
    profileReady ? {} : "skip",
  ) as WishlistSummary[] | undefined;
  const createWishlist = useMutation(api.dashboard.createWishlist);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  async function create(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createWishlist({ name: trimmed });
      setName("");
      setError(undefined);
    } catch {
      setError("Couldn't create that wishlist. Try again.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.05em]">
            Wishlists
          </h1>
          <p className="mt-1 text-checkin-muted">
            Stays you&apos;ve saved, grouped however you like. Only you can see
            them.
          </p>
        </div>
        <form onSubmit={create} className="flex gap-2">
          <label htmlFor="new-wishlist" className="sr-only">
            New wishlist name
          </label>
          <input
            id="new-wishlist"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="New wishlist"
            className="min-h-11 w-56 rounded-[0.8rem] border border-checkin-line bg-checkin-paper px-3 text-sm outline-none focus:border-checkin-ink"
          />
          <Button type="submit" disabled={!name.trim()}>
            <Plus aria-hidden className="size-4" /> Create
          </Button>
        </form>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-checkin-signal">
          {error}
        </p>
      ) : null}

      {wishlists === undefined ? (
        <p className="mt-10 text-checkin-muted">Loading wishlists…</p>
      ) : wishlists.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-checkin-line px-6 py-16 text-center">
          <Heart aria-hidden className="size-7 text-checkin-muted" />
          <p className="font-semibold">No wishlists yet</p>
          <p className="max-w-sm text-sm text-checkin-muted">
            Tap the heart on any stay to save it here.
          </p>
          <Link
            href="/"
            className="mt-1 text-sm font-semibold underline underline-offset-4 hover:text-checkin-signal"
          >
            Browse stays
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {wishlists.map((wishlist) => (
            <li key={wishlist._id}>
              <Link
                href={`/wishlists/${wishlist._id}`}
                className="flex min-h-32 flex-col justify-between rounded-[1.1rem] border border-checkin-line bg-checkin-paper p-5 transition-colors hover:border-checkin-ink/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
              >
                <Heart aria-hidden className="size-5 text-checkin-signal" />
                <span>
                  <span className="block truncate font-semibold">
                    {wishlist.name}
                  </span>
                  <span className="text-sm text-checkin-muted">
                    {wishlist.itemCount}{" "}
                    {wishlist.itemCount === 1 ? "stay" : "stays"} saved
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
