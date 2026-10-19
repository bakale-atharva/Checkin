"use client";

import { useConvexConnectionState } from "convex/react";
import { WifiOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

/** Brief reconnects (tab wake, auth refresh) shouldn't flash a warning. */
const GRACE_MS = 3000;

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Tells people when live data has stopped updating. Convex reconnects and
 * replays queued changes on its own, so this only explains the wait. The
 * browser's offline signal shows it at once; a dropped socket on an otherwise
 * working network shows it after a short grace period.
 */
export function ConnectionBanner() {
  const { isWebSocketConnected, hasEverConnected, inflightMutations } =
    useConvexConnectionState();
  const browserOnline = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [socketDown, setSocketDown] = useState(false);

  useEffect(() => {
    if (isWebSocketConnected) {
      const reset = setTimeout(() => setSocketDown(false), 0);
      return () => clearTimeout(reset);
    }
    const timer = setTimeout(() => setSocketDown(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, [isWebSocketConnected]);

  const offline = !browserOnline || socketDown;

  return (
    <div role="status" aria-live="polite">
      {offline ? (
        <p className="flex items-center justify-center gap-2 border-b border-checkin-line bg-checkin-mist px-4 py-2 text-center text-sm font-medium text-checkin-ink">
          <WifiOff aria-hidden className="size-4 shrink-0" />
          {!hasEverConnected && browserOnline
            ? "We can’t reach Checkin right now. Retrying…"
            : inflightMutations > 0
              ? "You’re offline. Your changes will be sent when you reconnect."
              : "You’re offline. Showing the last loaded information."}
        </p>
      ) : null}
    </div>
  );
}
