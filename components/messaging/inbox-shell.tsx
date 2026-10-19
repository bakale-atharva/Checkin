"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { InboxList } from "./inbox-list";

/**
 * Two panes on wide screens; on narrow screens the list and the open
 * conversation each take the full width.
 */
export function InboxShell({ children }: { children: ReactNode }) {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const open = Boolean(conversationId);

  return (
    <main className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-[90rem] min-h-0 lg:px-8 lg:py-6">
      <div className="flex min-h-0 w-full overflow-hidden bg-checkin-paper lg:rounded-[1.1rem] lg:border lg:border-checkin-line">
        <div
          className={cn(
            "min-h-0 w-full flex-col lg:flex lg:w-[24rem] lg:shrink-0 lg:border-r lg:border-checkin-line",
            open ? "hidden" : "flex",
          )}
        >
          <InboxList selectedId={conversationId} />
        </div>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col lg:flex",
            open ? "flex" : "hidden",
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
