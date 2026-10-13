import assert from "node:assert/strict";
import test from "node:test";

import {
  ListingPolicyError,
  assertListingCanBeDeleted,
  assertListingCanBePublished,
  assertListingStatusTransition,
  isValidStayDate,
} from "./listing-policy";

test("allows a draft to be published and later returned to draft", () => {
  assert.doesNotThrow(() => assertListingStatusTransition("draft", "published"));
  assert.doesNotThrow(() => assertListingStatusTransition("published", "draft"));
});

test("prevents an archived listing from becoming reservable again", () => {
  assert.throws(
    () => assertListingStatusTransition("archived", "published"),
    (error: unknown) =>
      error instanceof ListingPolicyError && error.code === "LISTING_ARCHIVED",
  );
});

test("permits deletion only for drafts", () => {
  assert.doesNotThrow(() => assertListingCanBeDeleted("draft", false));
  assert.throws(
    () => assertListingCanBeDeleted("published", false),
    (error: unknown) =>
      error instanceof ListingPolicyError && error.code === "LISTING_NOT_DELETABLE",
  );
  assert.throws(
    () => assertListingCanBeDeleted("draft", true),
    (error: unknown) =>
      error instanceof ListingPolicyError && error.code === "LISTING_NOT_DELETABLE",
  );
});

test("requires a complete stay and price before publishing", () => {
  assert.throws(
    () =>
      assertListingCanBePublished({
        title: "",
        maxGuests: 0,
        nightlyPriceCents: 0,
        timezone: "Not/A_Timezone",
      }),
    (error: unknown) =>
      error instanceof ListingPolicyError && error.code === "LISTING_NOT_PUBLISHABLE",
  );
});

test("accepts only real ISO local stay dates", () => {
  assert.equal(isValidStayDate("2026-02-28"), true);
  assert.equal(isValidStayDate("2026-02-29"), false);
  assert.equal(isValidStayDate("2026-2-8"), false);
});
