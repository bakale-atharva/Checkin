import { clerkSetup } from "@clerk/testing/playwright";

/** Fetches a Clerk testing token so signed-in journeys skip bot protection. */
export default async function globalSetup() {
  await clerkSetup();
}
