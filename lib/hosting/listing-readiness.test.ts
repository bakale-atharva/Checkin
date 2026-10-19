import assert from "node:assert/strict";
import test from "node:test";

import {
  adjacentWizardStep,
  centsToDollarInput,
  listingReadinessIssues,
  parseDollarsToCents,
  parseWizardStep,
  type ReadinessInput,
} from "./listing-readiness";

const ready: ReadinessInput = {
  title: "Harbor loft",
  description: "Bright loft above the harbor.",
  category: "City stays",
  maxGuests: 2,
  nightlyPriceCents: 18_000,
  timezone: "Europe/Lisbon",
  privateAddress: { line1: "12 Rua Nova", city: "Lisbon", countryCode: "PT" },
  publicLocation: {
    city: "Lisbon",
    countryCode: "PT",
    latitude: 38.71,
    longitude: -9.14,
  },
  photoCount: 3,
};

test("a complete listing has no readiness issues", () => {
  assert.deepEqual(listingReadinessIssues(ready), []);
});

test("a fresh draft points each gap at the step that fixes it", () => {
  const issues = listingReadinessIssues({
    ...ready,
    title: "Untitled stay",
    description: "",
    category: "",
    timezone: "UTC",
    privateAddress: { line1: "", city: "", countryCode: "" },
    publicLocation: { city: "", countryCode: "", latitude: 0, longitude: 0 },
    photoCount: 0,
    nightlyPriceCents: 0,
  });
  assert.deepEqual(
    [...new Set(issues.map((issue) => issue.step))],
    ["basics", "location", "photos", "pricing"],
  );
});

test("rejects an unknown timezone", () => {
  const issues = listingReadinessIssues({ ...ready, timezone: "Mars/Base" });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.step, "location");
});

test("parses wizard steps and falls back to the first step", () => {
  assert.equal(parseWizardStep("photos"), "photos");
  assert.equal(parseWizardStep("nope"), "basics");
  assert.equal(parseWizardStep(null), "basics");
  assert.equal(adjacentWizardStep("basics", 1), "location");
  assert.equal(adjacentWizardStep("basics", -1), null);
  assert.equal(adjacentWizardStep("review", 1), null);
});

test("converts typed dollar amounts to cents", () => {
  assert.equal(parseDollarsToCents("180"), 18_000);
  assert.equal(parseDollarsToCents("$1,250.5"), 125_050);
  assert.equal(parseDollarsToCents(" 0.99 "), 99);
  assert.equal(parseDollarsToCents("12.345"), null);
  assert.equal(parseDollarsToCents("-5"), null);
  assert.equal(parseDollarsToCents(""), null);
  assert.equal(centsToDollarInput(18_000), "180");
  assert.equal(centsToDollarInput(125_050), "1250.50");
});
