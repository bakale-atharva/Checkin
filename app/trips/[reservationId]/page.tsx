import { auth } from "@clerk/nextjs/server";

import { TripDetail } from "@/components/trips/trip-detail";

export default async function TripPage() {
  await auth.protect();
  return <TripDetail />;
}
