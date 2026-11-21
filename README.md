# SentryLedger

A secure, offline-first desktop finance tracker that auto-categorizes bank CSVs via editable rules, visualizes budgets with charts, and calculates safe-to-spend amounts — all running locally with zero cloud dependency.

## Features

- **CSV/OFX import** with automatic bank profile detection and column mapping wizard
- **Visual rule builder** with regex support, priority ordering, and live preview
- **Monthly budgets** with real-time progress tracking and alerts
- **Interactive charts** for spending by category, trend analysis, and cash flow
- **Safe-to-spend calculator** based on income, bills, and savings goals
- **Duplicate detection** and transaction linking between accounts
- **Encrypted local SQLite** database with backup/restore
- **Export** transactions as CSV or the full dashboard as PDF reports
- **Dark mode** and responsive layout
- **One-click desktop installer** for Windows, macOS, and Linux

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Desktop:** Tauri 2 (Rust backend)
- **Database:** SQLite via Prisma
- **Charts:** Recharts
- **Testing:** Vitest + jsdom
- **CSV Parsing:** PapaParse

## Getting Started

### Prerequisites

- **Node.js** 22+
- **Rust** 1.90+ (for Tauri desktop builds)
- **System dependencies** (Linux):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libssl2.0-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Installation

```bash
cd sentry-ledger
npm install
```

### Development

Run the Next.js dev server (for browser development):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Run the Tauri desktop app:

```bash
npm run tauri dev
```

This starts the Next.js dev server and launches the desktop window automatically.

### Building

Build the production web app:

```bash
npm run build
```

Build the desktop binaries (Windows, macOS, Linux):

```bash
npm run tauri build
```

Output binaries are placed in `src-tauri/target/release/bundle/`.

### Testing

Run the test suite:

```bash
npm run test
```

Watch mode:

```bash
npm run test:watch
```

## Project Structure

```
sentry-ledger/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── layout.tsx    # Root layout with Tailwind theme
│   │   ├── page.tsx      # Home page with navigation
│   │   ├── import/       # Import page with CSV upload, mapping, preview
│   │   │   └── page.tsx  # Full import flow UI
│   │   ├── rules/        # Rule management page
│   │   │   └── page.tsx  # CRUD UI for categorization rules
│   │   ├── budgets/      # Budget management page
│   │   │   └── page.tsx  # Budget creation, progress tracking, alerts
│   │   ├── api/          # API routes
│   │   │   ├── import/   # Transaction import API
│   │   │   │   └── route.ts
│   │   │   ├── rules/    # Rule management API
│   │   │   │   └── route.ts
│   │   │   ├── budgets/  # Budget management API
│   │   │   │   └── route.ts
│   │   │   ├── export/   # Export API routes
│   │   │   │   ├── csv/  # CSV export
│   │   │   │   │   └── route.ts
│   │   │   │   └── pdf/  # PDF export
│   │   │   │       └── route.ts
│   │   │   └── dashboard/ # Dashboard data API
│   │   │       └── route.ts
│   │   └── globals.css   # Tailwind CSS with dark mode
│   ├── components/       # Reusable UI components
│   └── lib/              # Shared utilities
│       ├── csv/          # CSV parser with bank profile detection
│       │   ├── types.ts  # Core type definitions
│       │   ├── bank-profiles.ts  # 10 known bank formats
│       │   ├── parser.ts # Date/amount parsing, column mapping
│       │   └── index.ts  # Barrel export
│       ├── import/       # Import database utilities
│       │   └── db.ts     # SQLite operations (server-only)
│       ├── rules/        # Rule engine
│       │   ├── engine.ts # Rule matching, validation, default rules
│       │   └── index.ts  # Barrel export
│       └── budgets/      # Budget calculation engine
│           └── engine.ts # Budget progress, alerts, category breakdown
├── src-tauri/            # Tauri Rust backend
│   ├── src/              # Rust source code
│   ├── tauri.conf.json   # Tauri configuration
│   └── capabilities/     # App security capabilities
├── tests/                # Vitest test files
│   ├── csv-parser.test.ts    # CSV parser tests (47 tests)
│   ├── import-db.test.ts     # Import DB tests (20 tests)
│   ├── rule-engine.test.ts   # Rule engine tests (62 tests)
│   ├── rule-db.test.ts       # Rule DB CRUD tests (35 tests)
│   ├── budget-engine.test.ts # Budget engine tests (29 tests)
│   ├── budget-db.test.ts     # Budget DB CRUD tests (18 tests)
│   ├── setup.ts              # Test setup
│   └── setup.test.ts         # Setup verification
├── public/               # Static assets
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── next.config.ts
├── postcss.config.mjs
└── README.md
```

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Tauri App                  │
│  ┌───────────────────────────────────────┐  │
│  │         Next.js Frontend              │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │  │
│  │  │  Import │ │  Rules  │ │  Budget │ │  │
│  │  │  Page   │ │  Editor │ │  Tracker│ │  │
│  │  └─────────┘ └─────────┘ └─────────┘ │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │         Rust Backend (Tauri)          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │  │
│  │  │  CSV    │ │  Rule   │ │  SQLite │ │  │
│  │  │  Parser │ │  Engine │ │  Store  │ │  │
│  │  └─────────┘ └─────────┘ └─────────┘ │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

The app runs entirely offline. All data is stored in a local SQLite database. No external API calls are made.

### Pages

- **`/safe-to-spend`** — Safe-to-spend calculator: view available spending, daily breakdown, and savings goals

### Export

Export functionality is available from the Dashboard and Import pages:

- **CSV Export** — Download all transactions as a CSV file with columns: Date, Description, Amount, Category, Is Bill, Is Duplicate, Account
- **PDF Export** — Download a comprehensive financial report as PDF including summary, spending by category, cash flow, monthly trends, recent transactions, accounts, budgets, and savings goals

Both exports are triggered via buttons in the page headers and download directly to the user's browser.
- **`/import`** — CSV import flow: upload → column mapping → preview → commit
- **`/rules`** — Rule management: create, edit, reorder, test, and delete categorization rules
- **`/budgets`** — Budget management: create budgets by category, track spending progress, view alerts for over-budget categories

### Budget System

The budget system tracks spending by category against user-defined limits:

1. **Create a budget** — Set a name, category, amount, and period (weekly/monthly/yearly)
2. **Track progress** — Real-time progress bars show spent vs. budgeted amounts
3. **Alerts** — Warnings at 80% usage, over-budget alerts when exceeded
4. **Category breakdown** — Aggregate spending across all categories with sorting by spend amount

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/import` | POST | Import transactions from CSV |
| `/api/rules` | GET | List all rules |
| `/api/rules` | POST | Create a new rule |
| `/api/rules` | PUT | Update an existing rule |
| `/api/rules` | DELETE | Delete a rule |
| `/api/rules?action=categories` | GET | Get unique categories |
| `/api/rules?action=test` | GET | Test a rule against sample transactions |
| `/api/budgets` | GET | List all budgets |
| `/api/budgets` | POST | Create a new budget |
| `/api/budgets` | PUT | Update an existing budget |
| `/api/budgets` | DELETE | Delete a budget |
| `/api/budgets?action=calculate` | GET | Calculate budget progress across all budgets |
| `/api/budgets?action=categories` | GET | Get unique categories |
| `/api/export/csv` | GET | Export all transactions as CSV |
| `/api/export/pdf` | GET | Export dashboard as PDF report |

## License

MIT
