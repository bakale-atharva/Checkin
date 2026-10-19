import { auth } from "@clerk/nextjs/server";

import { HostCalendarView } from "@/components/hosting/host-calendar-view";

export default async function HostCalendarPage() {
  await auth.protect();
  return <HostCalendarView />;
}
