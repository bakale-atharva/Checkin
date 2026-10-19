import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSearchInput } from "../search/search-contract";
import {
  countRefinements,
  parseDiscoveryParams,
  serializeDiscoveryParams,
  toSearchInput,
} from "./discovery-params";

const params = (query: string) => new URLSearchParams(query);

test("round-trips every supported filter through the URL", () => {
  const query =
    "where=Lisbon&checkIn=2027-01-10&checkOut=2027-01-13&guests=2&category=Design+stays&type=entire_home&minPrice=80&maxPrice=240&amenities=Kitchen%2CWifi&mode=instant&sort=price";
  const filters = parseDiscoveryParams(params(query));

  assert.equal(filters.where, "Lisbon");
  assert.equal(filters.guests, 2);
  assert.deepEqual(filters.amenities, ["Kitchen", "Wifi"]);
  assert.equal(serializeDiscoveryParams(filters), query);
});

test("keeps the map view in the URL and leaves it out of the search", () => {
  const filters = parseDiscoveryParams(params("where=Lisbon&view=map"));

  assert.equal(filters.view, "map");
  assert.equal(serializeDiscoveryParams(filters), "where=Lisbon&view=map");
  assert.equal("view" in toSearchInput(filters), false);
  assert.equal(parseDiscoveryParams(params("view=grid")).view, undefined);
});

test("drops malformed values instead of failing the page", () => {
  const filters = parseDiscoveryParams(
    params(
      "guests=0&type=castle&mode=maybe&sort=random&minPrice=-5&maxPrice=abc&near=999,1",
    ),
  );

  assert.equal(filters.guests, undefined);
  assert.equal(filters.type, undefined);
  assert.equal(filters.mode, undefined);
  assert.equal(filters.sort, undefined);
  assert.equal(filters.minPrice, undefined);
  assert.equal(filters.maxPrice, undefined);
  assert.equal(filters.near, undefined);
});

test("requires both dates and a one-to-twenty-eight-night stay", () => {
  assert.equal(
    parseDiscoveryParams(params("checkIn=2027-01-10")).checkIn,
    undefined,
  );
  assert.equal(
    parseDiscoveryParams(params("checkIn=2027-01-10&checkOut=2027-01-10"))
      .checkIn,
    undefined,
  );
  assert.equal(
    parseDiscoveryParams(params("checkIn=2027-01-01&checkOut=2027-02-15"))
      .checkOut,
    undefined,
  );
  assert.equal(
    parseDiscoveryParams(params("checkIn=2027-01-01&checkOut=2027-01-29"))
      .checkOut,
    "2027-01-29",
  );
});

test("swaps an inverted price range", () => {
  const filters = parseDiscoveryParams(params("minPrice=300&maxPrice=100"));
  assert.equal(filters.minPrice, 100);
  assert.equal(filters.maxPrice, 300);
});

test("keeps distance sort only when an origin is known", () => {
  assert.equal(parseDiscoveryParams(params("sort=distance")).sort, undefined);
  assert.equal(
    parseDiscoveryParams(params("where=kyoto&sort=distance")).sort,
    "distance",
  );
  assert.equal(
    parseDiscoveryParams(params("where=Porto&near=41.15,-8.61&sort=distance"))
      .sort,
    "distance",
  );
});

test("produces search input the backend contract accepts", () => {
  const filters = parseDiscoveryParams(
    params(
      "where=Kyoto&checkIn=2027-03-01&checkOut=2027-03-04&minPrice=90&maxPrice=150&sort=distance",
    ),
  );
  const input = toSearchInput(filters);

  assert.equal(input.minNightlyPriceCents, 9000);
  assert.equal(input.maxNightlyPriceCents, 15000);
  assert.deepEqual(input.origin, { latitude: 35.0116, longitude: 135.7681 });
  assert.doesNotThrow(() => normalizeSearchInput(input));
});

test("counts refinements shown on the filters button", () => {
  assert.equal(countRefinements(parseDiscoveryParams(params("where=x"))), 0);
  assert.equal(
    countRefinements(
      parseDiscoveryParams(
        params(
          "type=private_room&minPrice=50&amenities=Wifi,Kitchen&mode=request",
        ),
      ),
    ),
    5,
  );
});
