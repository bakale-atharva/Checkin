import type { ReactNode } from "react";

import { HostingNav } from "@/components/hosting/hosting-nav";

export default function HostingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HostingNav />
      {children}
    </>
  );
}
