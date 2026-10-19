import { auth } from "@clerk/nextjs/server";
import type { ReactNode } from "react";

import { InboxShell } from "@/components/messaging/inbox-shell";

export default async function InboxLayout({
  children,
}: {
  children: ReactNode;
}) {
  await auth.protect();
  return <InboxShell>{children}</InboxShell>;
}
