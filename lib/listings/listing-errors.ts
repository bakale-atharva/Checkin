export enum ListingErrorCode {
  InvalidState = "INVALID_LISTING_STATE",
  NotFound = "LISTING_NOT_FOUND",
  InvalidInput = "INVALID_LISTING_INPUT",
  InvalidPhoto = "INVALID_LISTING_PHOTO",
  UploadNotFound = "LISTING_UPLOAD_NOT_FOUND",
}

const messages = {
  [ListingErrorCode.InvalidState]:
    "This listing cannot be changed in its current state.",
  [ListingErrorCode.NotFound]: "The requested listing was not found.",
  [ListingErrorCode.InvalidInput]: "The listing details are invalid.",
  [ListingErrorCode.InvalidPhoto]: "The listing photo is invalid.",
  [ListingErrorCode.UploadNotFound]: "The pending photo upload was not found.",
} as const;

export function listingError(code: ListingErrorCode) {
  return { code, message: messages[code] };
}
