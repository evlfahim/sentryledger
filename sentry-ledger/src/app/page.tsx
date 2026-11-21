import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            SentryLedger
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/import"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Import
            </Link>
            <Link
              href="/rules"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Rules
            </Link>
            <Link
              href="/budgets"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Budgets
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">SentryLedger</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Personal Finance Tracker — import bank CSVs, auto-categorize spending,
            visualize budgets, and calculate safe-to-spend amounts. All offline,
            all local.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto text-center"
            >
              View Dashboard
            </Link>
            <Link
              href="/import"
              className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors w-full sm:w-auto text-center"
            >
              Import Transactions
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="max-w-4xl mx-auto mt-20 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 bg-card rounded-lg border border-border">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">CSV Import</h3>
            <p className="text-sm text-muted-foreground">
              Import bank CSV files with auto-detection and column mapping.
              Duplicate detection ensures clean data.
            </p>
          </div>

          <div className="p-6 bg-card rounded-lg border border-border">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Smart Rules</h3>
            <p className="text-sm text-muted-foreground">
              Create regex-based categorization rules with priority ordering,
              amount filters, and live preview testing.
            </p>
          </div>

          <div className="p-6 bg-card rounded-lg border border-border">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Budget Tracking</h3>
            <p className="text-sm text-muted-foreground">
              Set spending limits by category, track progress in real-time,
              and get alerts when you're approaching your limits.
            </p>
          </div>

          <div className="p-6 bg-card rounded-lg border border-border">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Privacy First</h3>
            <p className="text-sm text-muted-foreground">
              All data stays on your machine. SQLite database, zero cloud
              dependency, complete financial privacy.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
