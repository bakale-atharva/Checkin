import { auth } from "@clerk/nextjs/server";

import { TripsOverview } from "@/components/trips/trips-overview";

export default async function TripsPage() {
  await auth.protect();
  return <TripsOverview />;
}
