export default function Loading() {
  return (
    <div className="container section" role="status" aria-live="polite" aria-label="Loading">
      <div className="animate-pulse space-y-8">
        <div className="flex items-center gap-2">
          <div className="h-3 bg-ink-grey-light/30 rounded w-16" />
          <div className="h-3 bg-ink-grey-light/30 rounded w-24" />
        </div>
        <div className="h-10 bg-ink-grey-light/30 rounded w-3/4" />
        <div className="h-5 bg-ink-grey-light/30 rounded w-2/3" />
        <div className="h-4 bg-ink-grey-light/30 rounded w-1/2" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card">
              <div className="h-40 bg-ink-grey-light/20 rounded-t-xl" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-ink-grey-light/30 rounded w-1/3" />
                <div className="h-6 bg-ink-grey-light/30 rounded w-3/4" />
                <div className="h-3 bg-ink-grey-light/30 rounded w-full" />
                <div className="h-3 bg-ink-grey-light/30 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading content…</span>
    </div>
  );
}
