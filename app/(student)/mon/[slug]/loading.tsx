export default function SubjectLoading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-card p-4" />
        ))}
      </main>
    </div>
  );
}
