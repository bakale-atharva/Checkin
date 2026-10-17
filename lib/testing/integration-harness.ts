import { randomBytes } from "node:crypto";

import { ConvexHttpClient } from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  getIntegrationTarget,
  TEST_IDENTITY_ISSUER,
} from "./integration-target";

type AnyFunction = FunctionReference<
  "query" | "mutation",
  "public" | "internal"
>;

type AdminCapableClient = ConvexHttpClient & {
  // Both are public at runtime but marked @internal in the published types.
  setAdminAuth(token: string, actingAsIdentity?: Record<string, string>): void;
  function(
    fn: AnyFunction,
    componentPath: string | undefined,
    args: unknown,
  ): Promise<unknown>;
};

/** A Convex client acting as one synthetic, run-scoped identity (or as the deployment admin). */
export class IntegrationClient {
  constructor(private readonly client: AdminCapableClient) {}

  async run<F extends AnyFunction>(
    fn: F,
    args: FunctionArgs<F>,
  ): Promise<FunctionReturnType<F>> {
    return (await this.client.function(
      fn,
      undefined,
      args,
    )) as FunctionReturnType<F>;
  }
}

export type IntegrationHarness = Awaited<
  ReturnType<typeof createIntegrationHarness>
>;

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function createIntegrationHarness() {
  const target = getIntegrationTarget(process.env);
  const runId = randomBytes(8)
    .toString("hex")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  function client(identity?: Record<string, string>) {
    const raw = new ConvexHttpClient(target.url, {
      logger: false,
    }) as AdminCapableClient;
    raw.setAdminAuth(target.deployKey, identity);
    return new IntegrationClient(raw);
  }

  const admin = client();
  const role = await admin.run(internal.testing.deploymentRole, {});
  if (role !== "test") {
    throw new Error(
      `Refusing to run: ${target.deploymentName} reports CHECKIN_DEPLOYMENT_ROLE=${role}, not "test".`,
    );
  }

  const users = new Map<
    string,
    { client: IntegrationClient; profileId: Id<"users">; clerkUserId: string }
  >();

  /** Returns a signed-in client for a role, bootstrapping its profile on first use. */
  async function as(roleName: string) {
    const existing = users.get(roleName);
    if (existing) return existing;
    const subject = `itest_${runId}_${roleName}`;
    const user = client({
      subject,
      issuer: TEST_IDENTITY_ISSUER,
      name: `Test ${roleName}`,
      email: `${roleName}@checkin-itest.invalid`,
    });
    const profile = await user.run(api.users.bootstrapProfile, {});
    const entry = {
      client: user,
      profileId: profile._id,
      clerkUserId: profile.clerkUserId,
    };
    users.set(roleName, entry);
    return entry;
  }

  /** Drives the real host flow up to publishing: draft, details, photo upload. */
  async function prepareListing(
    host: IntegrationClient,
    overrides: {
      bookingMode?: "instant" | "request";
      nightlyPriceCents?: number;
      title?: string;
    } = {},
  ) {
    const draft = await host.run(api.listings.createDraft, {});
    await host.run(api.listings.update, {
      listingId: draft._id,
      fields: {
        title: overrides.title ?? `Integration stay ${runId}`,
        description: "Fixture listing created by the integration suite.",
        maxGuests: 4,
        bedrooms: 2,
        beds: 2,
        nightlyPriceCents: overrides.nightlyPriceCents ?? 15_000,
        cleaningFeeCents: 5_000,
        timezone: "America/New_York",
        bookingMode: overrides.bookingMode ?? "instant",
        privateAddress: {
          line1: "1 Test Way",
          city: "Austin",
          postalCode: "78701",
          countryCode: "US",
        },
        publicLocation: {
          city: "Austin",
          countryCode: "US",
          latitude: 30.2672,
          longitude: -97.7431,
        },
      },
    });
    const uploadUrl = await host.run(api.listings.generatePhotoUploadUrl, {
      listingId: draft._id,
    });
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: ONE_PIXEL_PNG,
    });
    if (!upload.ok)
      throw new Error(`Photo upload failed with HTTP ${upload.status}.`);
    const { storageId } = (await upload.json()) as {
      storageId: Id<"_storage">;
    };
    const uploadId = await host.run(api.listings.registerUploadedPhoto, {
      listingId: draft._id,
      storageId,
    });
    await host.run(api.listings.attachPhoto, {
      listingId: draft._id,
      uploadId,
      altText: "Fixture photo",
    });
    return draft._id;
  }

  async function publishListing(
    host: IntegrationClient,
    overrides: Parameters<typeof prepareListing>[1] = {},
  ) {
    const listingId = await prepareListing(host, overrides);
    return await host.run(api.listings.setStatus, {
      listingId,
      status: "published",
    });
  }

  async function inspect(reservationId: Id<"reservations">) {
    return await admin.run(internal.testing.inspectReservation, {
      reservationId,
    });
  }

  async function book(
    guest: IntegrationClient,
    listingId: Id<"listings">,
    dates: { checkIn: string; checkOut: string },
  ) {
    const { quoteId } = await guest.run(api.reservations.quote, {
      listingId,
      ...dates,
      guests: 2,
    });
    return await guest.run(api.reservations.createFromQuote, {
      quoteId,
      idempotencyKey: `book-${quoteId}`,
    });
  }

  /** Books an instant stay and waits for the simulated charge to confirm it. */
  async function bookAndPay(
    guest: IntegrationClient,
    listingId: Id<"listings">,
    dates: { checkIn: string; checkOut: string },
  ) {
    const reservation = await book(guest, listingId, dates);
    await guest.run(api.reservations.capturePayment, {
      reservationId: reservation._id,
      idempotencyKey: `pay-${reservation._id}`,
    });
    await eventually(
      () => inspect(reservation._id),
      (state) => state?.reservation.status === "confirmed",
    );
    return reservation;
  }

  /** Moves a confirmed stay into the past and runs the completion transition. */
  async function completeStay(
    reservationId: Id<"reservations">,
    checkedOutDaysAgo = 1,
  ) {
    const day = 24 * 60 * 60 * 1000;
    const checkOutAt = Date.now() - checkedOutDaysAgo * day;
    await admin.run(internal.testing.shiftReservationTimes, {
      reservationId,
      checkIn: new Date(checkOutAt - 2 * day).toISOString().slice(0, 10),
      checkOut: new Date(checkOutAt).toISOString().slice(0, 10),
      checkInAt: new Date(checkOutAt - 2 * day).toISOString(),
      checkOutAt: new Date(checkOutAt).toISOString(),
    });
    const completed = await admin.run(internal.reservations.markCompleted, {
      reservationId,
    });
    if (!completed) throw new Error("Stay could not be completed.");
  }

  async function cleanup() {
    return await admin.run(internal.testing.cleanupRun, { runId });
  }

  return {
    runId,
    admin,
    as,
    prepareListing,
    publishListing,
    inspect,
    book,
    bookAndPay,
    completeStay,
    cleanup,
    deploymentName: target.deploymentName,
  };
}

/** Future stay dates (YYYY-MM-DD) offset from today, keeping tests clear of cutoffs. */
export function stayDates(startOffsetDays: number, nights: number) {
  const day = 24 * 60 * 60 * 1000;
  const start = new Date(Date.now() + startOffsetDays * day);
  const toDate = (date: Date) => date.toISOString().slice(0, 10);
  return {
    checkIn: toDate(start),
    checkOut: toDate(new Date(start.getTime() + nights * day)),
  };
}

/** Polls until the predicate holds, for effects settled by scheduled functions. */
export async function eventually<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 20_000,
) {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!predicate(value)) {
    if (Date.now() > deadline)
      throw new Error(
        `Condition not met within ${timeoutMs}ms; last value: ${JSON.stringify(value)}`,
      );
    await new Promise((resolve) => setTimeout(resolve, 250));
    value = await read();
  }
  return value;
}

/** Extracts the stable ConvexError code, or the message for other failures. */
export async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "code" in data)
      return String((data as { code: unknown }).code);
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}
