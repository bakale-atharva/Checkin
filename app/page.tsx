import { Suspense } from "react";

import { DiscoveryView } from "@/components/discovery/discovery-view";

export default function Home() {
  return (
    // Discovery reads its filters from the URL, so it renders on the client.
    <Suspense fallback={<main className="flex-1" aria-busy="true" />}>
      <DiscoveryView />
    </Suspense>
  );
}
