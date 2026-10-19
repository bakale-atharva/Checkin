import { auth } from "@clerk/nextjs/server";

import { HostingOverview } from "@/components/hosting/hosting-overview";

export default async function HostingPage() {
  await auth.protect();
  return <HostingOverview />;
}
