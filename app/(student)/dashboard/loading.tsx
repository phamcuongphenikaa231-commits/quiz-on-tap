export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-36 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-2 h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="mb-6 h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-card p-4" />
          ))}
        </div>
      </main>
    </div>
  );
}
