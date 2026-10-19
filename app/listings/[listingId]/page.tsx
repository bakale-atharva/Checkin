import { Suspense } from "react";

import { ListingDetail } from "@/components/listing/listing-detail";

export default function ListingPage() {
  return (
    <Suspense>
      <ListingDetail />
    </Suspense>
  );
}
