"use client";

import { useMutation } from "convex/react";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { ListingPhoto } from "@/components/discovery/listing-photo";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { errorMessage } from "./form-controls";

const MAX_PHOTOS = 20;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export type ManagedPhoto = {
  _id: Id<"listingPhotos">;
  url: string | null;
  altText?: string;
  position: number;
};

const iconButton =
  "grid size-9 place-items-center rounded-full bg-checkin-paper/95 text-checkin-ink shadow-sm transition-colors hover:bg-checkin-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/45 disabled:opacity-35";

export function PhotoManager({
  listingId,
  photos,
  coverPhotoId,
}: {
  listingId: Id<"listings">;
  photos: ManagedPhoto[];
  coverPhotoId: Id<"listingPhotos"> | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.listings.generatePhotoUploadUrl);
  const registerUpload = useMutation(api.listings.registerUploadedPhoto);
  const attachPhoto = useMutation(api.listings.attachPhoto);
  const removePhoto = useMutation(api.listings.removePhoto);
  const setPhotoOrder = useMutation(api.listings.setPhotoOrder);
  const setCoverPhoto = useMutation(api.listings.setCoverPhoto);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = [...photos].sort((a, b) => a.position - b.position);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - ordered.length;
    const chosen = Array.from(files).slice(0, Math.max(room, 0));
    const rejected = chosen.filter(
      (file) =>
        !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES,
    );
    const accepted = chosen.filter((file) => !rejected.includes(file));
    if (files.length > room)
      setError(`Listings can have up to ${MAX_PHOTOS} photos.`);
    if (rejected.length)
      setError(
        `${rejected.length} file${rejected.length === 1 ? " was" : "s were"} skipped — use JPEG, PNG, WebP, or AVIF under 10 MB.`,
      );
    setUploading(accepted.length);
    for (const file of accepted) {
      try {
        const uploadUrl = await generateUploadUrl({ listingId });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error("Upload failed");
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        const uploadId = await registerUpload({ listingId, storageId });
        await attachPhoto({
          listingId,
          uploadId,
          altText: file.name.replace(/\.[^.]+$/, "").slice(0, 120),
        });
      } catch (caught) {
        setError(errorMessage(caught, `Couldn't upload ${file.name}.`));
      } finally {
        setUploading((count) => count - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught, fallback));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, offset: -1 | 1) {
    const next = [...ordered];
    const [photo] = next.splice(index, 1);
    next.splice(index + offset, 0, photo!);
    return run(
      () =>
        setPhotoOrder({
          listingId,
          photoIds: next.map((item) => item._id),
        }),
      "Couldn't reorder photos.",
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-checkin-muted">
          {ordered.length} of {MAX_PHOTOS} photos. The cover photo leads your
          listing card.
        </p>
        <input
          ref={inputRef}
          id="listing-photo-input"
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(event) => void uploadFiles(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading > 0 || ordered.length >= MAX_PHOTOS}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden className="size-4" />
          {uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-checkin-signal">
          {error}
        </p>
      ) : null}

      {ordered.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-[1rem] border border-dashed border-checkin-line px-6 py-14 text-center transition-colors hover:bg-checkin-mist/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
        >
          <ImagePlus aria-hidden className="size-7 text-checkin-muted" />
          <span className="font-semibold">Upload your first photo</span>
          <span className="text-sm text-checkin-muted">
            Bright, wide shots of the main living space work best.
          </span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 @lg/wizard:grid-cols-3">
          {ordered.map((photo, index) => {
            const isCover = photo._id === coverPhotoId;
            const label = photo.altText || `Photo ${index + 1}`;
            return (
              <li
                key={photo._id}
                className={cn(
                  "relative aspect-[4/3] overflow-hidden rounded-[0.9rem] border border-checkin-line",
                  isCover && "ring-2 ring-checkin-ink ring-offset-2",
                )}
              >
                <ListingPhoto
                  src={photo.url}
                  alt={label}
                  sizes="(min-width: 1024px) 18rem, 50vw"
                />
                {isCover ? (
                  <span className="absolute top-2 left-2 rounded-full bg-checkin-ink px-2.5 py-1 text-xs font-semibold text-checkin-canvas">
                    Cover
                  </span>
                ) : null}
                <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Move ${label} earlier`}
                      disabled={busy || index === 0}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowLeft aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Move ${label} later`}
                      disabled={busy || index === ordered.length - 1}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowRight aria-hidden className="size-4" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Use ${label} as cover`}
                      aria-pressed={isCover}
                      disabled={busy || isCover}
                      onClick={() =>
                        void run(
                          () =>
                            setCoverPhoto({ listingId, photoId: photo._id }),
                          "Couldn't change the cover photo.",
                        )
                      }
                    >
                      <Star
                        aria-hidden
                        className={cn("size-4", isCover && "fill-current")}
                      />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Remove ${label}`}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => removePhoto({ listingId, photoId: photo._id }),
                          "Couldn't remove the photo.",
                        )
                      }
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
