import { auth } from "@clerk/nextjs/server";

import { HostEarnings } from "@/components/hosting/host-earnings";

export default async function HostEarningsPage() {
  await auth.protect();
  return <HostEarnings />;
}
