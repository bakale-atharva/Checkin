import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * A listing photo is either a host upload in Convex storage or, for seeded demo
 * data only, a direct link to an allowed image host.
 */
export async function listingPhotoUrl(
  ctx: QueryCtx | MutationCtx,
  photo: Doc<"listingPhotos">,
) {
  if (photo.storageId) return await ctx.storage.getUrl(photo.storageId);
  return photo.externalUrl ?? null;
}

/** Deletes the stored file behind a photo; external links have nothing to delete. */
export async function deleteListingPhotoFile(
  ctx: MutationCtx,
  photo: Doc<"listingPhotos">,
) {
  if (photo.storageId) await ctx.storage.delete(photo.storageId);
}
