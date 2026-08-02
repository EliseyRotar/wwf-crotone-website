export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-live="polite" aria-label="Loading">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-ink-grey-light/30 rounded w-64" />
        <div className="h-9 bg-ink-grey-light/30 rounded w-40" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="h-10 bg-ink-grey-light/20 rounded w-16" />
            <div className="h-3 bg-ink-grey-light/30 rounded w-24" />
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-6 gap-2 p-3 border-b border-ink-grey-light/30">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-3 bg-ink-grey-light/30 rounded" />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
          <div key={row} className="grid grid-cols-6 gap-2 p-3 border-b border-ink-grey-light/20">
            {[1, 2, 3, 4, 5, 6].map((c) => (
              <div key={c} className="h-3 bg-ink-grey-light/15 rounded" />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
