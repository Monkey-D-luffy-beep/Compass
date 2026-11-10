/** Shown at once while the next page loads, so a tap never feels like nothing happened. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-56 animate-pulse rounded-xl bg-surface2" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card h-[104px] animate-pulse" />)}</div>
      <div className="card h-64 animate-pulse" />
    </div>
  );
}
