import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Repairs transitions whose scheduled job was missed and flags stalled or failed background work.
crons.interval(
  "reconcile background operations",
  { minutes: 15 },
  internal.operations.reconcileBackgroundOperations,
  {},
);

export default crons;
