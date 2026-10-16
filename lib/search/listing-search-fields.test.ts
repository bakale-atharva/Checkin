import assert from "node:assert/strict";
import test from "node:test";

import { listingSearchFields } from "./listing-search-fields";

test("derives normalized, public-only destination fields from a listing pin", () => {
  assert.deepEqual(
    listingSearchFields({ city: "  São Paulo ", countryCode: "br" }),
    { searchCity: "são paulo", searchCountryCode: "BR" },
  );
});
