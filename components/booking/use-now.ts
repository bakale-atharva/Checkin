"use client";

import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs` while mounted. */
export function useNow(intervalMs = 1_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "12:04" style countdown, or null once the deadline has passed. */
export function formatCountdown(deadline: number, now: number) {
  const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
  if (remaining === 0) return null;
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}:${seconds}`;
}
