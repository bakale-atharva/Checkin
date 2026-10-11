import assert from "node:assert/strict";
import test from "node:test";

import {
  isProtectedApplicationPath,
  protectedApplicationRoutePatterns,
} from "../lib/auth/routes";

test("marks private application areas as protected", () => {
  for (const path of [
    "/host",
    "/host/listings",
    "/trips",
    "/trips/reservation_123",
    "/checkout/reservation_123",
    "/messages",
    "/wishlists/summer",
    "/billing",
  ]) {
    assert.equal(isProtectedApplicationPath(path), true, path);
  }
});

test("leaves public discovery and sign-in paths accessible", () => {
  for (const path of ["/", "/search", "/listings/listing_123", "/sign-in"]) {
    assert.equal(isProtectedApplicationPath(path), false, path);
  }
});

test("uses slash-boundary proxy patterns so similarly named public paths stay public", () => {
  assert.deepEqual(protectedApplicationRoutePatterns.slice(0, 2), [
    "/host",
    "/host/(.*)",
  ]);
});
