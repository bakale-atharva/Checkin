"use client";

import { ChevronLeft, ChevronRight, Grid2x2, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import { ListingPhoto } from "@/components/discovery/listing-photo";
import { cn } from "@/lib/utils";

type Photo = { _id: string; url: string | null; altText?: string };

/**
 * Up to five photos in a mosaic, with every photo available in a modal viewer.
 * The native dialog traps focus and closes on Escape; focus returns to the
 * opener afterwards.
 */
export function PhotoGallery({
  photos,
  title,
}: {
  photos: Photo[];
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [index, setIndex] = useState(0);
  const alt = (photo: Photo, position: number) =>
    photo.altText || `${title}, photo ${position + 1} of ${photos.length}`;

  function open(position: number, opener: HTMLElement) {
    openerRef.current = opener;
    setIndex(position);
    dialogRef.current?.showModal();
  }

  function step(delta: number) {
    setIndex((current) => (current + delta + photos.length) % photos.length);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "ArrowRight") step(1);
    if (event.key === "ArrowLeft") step(-1);
  }

  if (photos.length === 0) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-[1.25rem]">
        <ListingPhoto src={null} alt={title} sizes="100vw" />
      </div>
    );
  }

  const mosaic = photos.slice(0, 5);
  const current = photos[index];

  return (
    <>
      <div
        className={cn(
          "relative grid gap-2 overflow-hidden rounded-[1.25rem]",
          mosaic.length >= 5
            ? "aspect-[2/1] grid-cols-4 grid-rows-2 max-md:aspect-[4/3] max-md:grid-cols-1 max-md:grid-rows-1"
            : "aspect-[16/9] grid-cols-1",
        )}
      >
        {(mosaic.length >= 5 ? mosaic : mosaic.slice(0, 1)).map(
          (photo, position) => (
            <button
              key={photo._id}
              type="button"
              onClick={(event) => open(position, event.currentTarget)}
              aria-label={`Open photo ${position + 1} of ${photos.length}`}
              className={cn(
                "relative overflow-hidden bg-checkin-mist focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-checkin-signal/60",
                position === 0 && mosaic.length >= 5 && "col-span-2 row-span-2",
                position > 0 && "max-md:hidden",
              )}
            >
              <ListingPhoto
                src={photo.url}
                alt={alt(photo, position)}
                sizes={
                  position === 0 ? "(min-width: 768px) 50vw, 100vw" : "25vw"
                }
                preload={position === 0}
                className="transition-transform duration-500 hover:scale-[1.02] motion-reduce:transition-none"
              />
            </button>
          ),
        )}
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={(event) => open(0, event.currentTarget)}
            className="absolute right-4 bottom-4 inline-flex min-h-10 items-center gap-2 rounded-[0.7rem] border border-checkin-ink/20 bg-checkin-paper px-3 text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/45"
          >
            <Grid2x2 aria-hidden className="size-4" />
            Show all {photos.length} photos
          </button>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        aria-label={`${title} photos`}
        onKeyDown={onKeyDown}
        onClose={() => openerRef.current?.focus()}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-checkin-ink p-0 text-checkin-canvas backdrop:bg-checkin-ink/80"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <p aria-live="polite" className="text-sm tabular-nums">
              {index + 1} / {photos.length}
            </p>
            <button
              type="button"
              autoFocus
              aria-label="Close photos"
              onClick={() => dialogRef.current?.close()}
              className="grid size-11 place-items-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/60"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="relative flex-1">
            {current ? (
              <ListingPhoto
                key={current._id}
                src={current.url}
                alt={alt(current, index)}
                sizes="100vw"
                className="object-contain"
              />
            ) : null}
          </div>
          {photos.length > 1 ? (
            <div className="flex justify-center gap-3 py-4">
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => step(-1)}
                className="grid size-11 place-items-center rounded-full border border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/60"
              >
                <ChevronLeft aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => step(1)}
                className="grid size-11 place-items-center rounded-full border border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/60"
              >
                <ChevronRight aria-hidden className="size-5" />
              </button>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
