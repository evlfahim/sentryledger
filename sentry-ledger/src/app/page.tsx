export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">SentryLedger</h1>
      <p className="text-lg text-muted-foreground">
        Personal Finance Tracker
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Import bank CSVs, auto-categorize spending, visualize budgets, and calculate safe-to-spend amounts.
      </p>
    </main>
  );
}
