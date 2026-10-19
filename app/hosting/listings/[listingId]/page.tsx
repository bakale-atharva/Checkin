import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

import { ListingWizard } from "@/components/hosting/listing-wizard";

export default async function ListingEditorPage() {
  await auth.protect();
  return (
    <Suspense>
      <ListingWizard />
    </Suspense>
  );
}
