/** Shown while a route's server work (such as the sign-in check) finishes. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="h-8 w-1/3 min-w-48 animate-pulse rounded bg-checkin-mist motion-reduce:animate-none" />
      <div className="mt-6 h-40 animate-pulse rounded-[1.1rem] bg-checkin-mist/70 motion-reduce:animate-none" />
      <p role="status" className="sr-only">
        Loading…
      </p>
    </main>
  );
}
