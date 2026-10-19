import { auth } from "@clerk/nextjs/server";

import { HostPlans } from "@/components/hosting/host-plans";

export default async function HostPlansPage() {
  await auth.protect();
  return <HostPlans />;
}
