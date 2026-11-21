# SentryLedger

> A secure, offline-first desktop finance tracker that auto-categorizes bank CSVs via editable rules, visualizes budgets with charts, and calculates safe-to-spend amounts — all running locally with zero cloud dependency.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
  - [Importing Transactions](#importing-transactions)
  - [Managing Rules](#managing-rules)
  - [Setting Budgets](#setting-budgets)
  - [Dashboard](#dashboard)
  - [Safe-to-Spend](#safe-to-spend)
  - [Exporting Data](#exporting-data)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Building](#building)
- [Configuration](#configuration)
- [License](#license)

---

## Features

- **CSV Import** — Drag-and-drop bank CSV upload with automatic bank profile detection (Chase, Bank of America, Wells Fargo, Capital One, Citibank, US Bank, TD Bank, Ally Bank, Credit Union, Generic) and an interactive column-mapping wizard
- **Auto-Categorization** — Rule engine with regex matching, priority ordering, amount filters, and direction filters. 12 built-in rules cover Groceries, Restaurants, Gas & Fuel, Transportation, Utilities, Insurance, Housing, Subscriptions, Health, Shopping, Income, and Transfers
- **Bill Detection** — Automatic identification of recurring bills (rent, mortgage, insurance, utilities, subscriptions) for safe-to-spend calculations
- **Duplicate Detection** — Case-insensitive matching with $0.01 amount tolerance, both within import batches and against existing database records
- **Visual Rule Builder** — Full CRUD interface for categorization rules with live preview (test a rule against sample transactions), regex validation, and drag-to-reorder priority
- **Monthly Budgets** — Create budgets by category with weekly/monthly/yearly periods, real-time progress bars, 80% warning alerts, and over-budget notifications
- **Interactive Charts** — Donut chart for spending by category, area chart for monthly trends, grouped bar chart for cash flow (income vs. expenses vs. net)
- **Safe-to-Spend Calculator** — Computes disposable income by subtracting bills, budgeted spending, and savings goals from monthly income. Includes daily breakdown and savings goal tracking
- **Savings Goals** — Create goals with target amounts, deadlines, and monthly contributions. Tracks progress and prates contributions based on remaining time
- **Dark Mode** — Toggle between light, dark, and system themes with localStorage persistence
- **Export** — Download all transactions as CSV or generate a comprehensive PDF financial report
- **Offline-First** — All data stored in a local SQLite database. No external API calls, no cloud dependency
- **Desktop App** — Native Tauri 2 application with deb, rpm, and AppImage bundles for Linux

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Charts** | Recharts |
| **Desktop** | Tauri 2 (Rust backend) |
| **Database** | SQLite via better-sqlite3 (server-side) |
| **CSV Parsing** | PapaParse |
| **PDF Generation** | PDFKit |
| **Testing** | Vitest 2, jsdom |
| **Data Validation** | Zod |
| **Date Handling** | date-fns |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        SentryLedger                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Next.js Frontend (React 19)                 │    │
│  │                                                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │    │
│  │  │  Import  │ │  Rules   │ │ Budgets  │ │  Dashboard │  │    │
│  │  │  Page    │ │  Editor  │ │  Tracker │ │  & Charts  │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │    │
│  │  ┌──────────┐ ┌──────────┐                                │    │
│  │  │ Safe-to- │ │  Home    │                                │    │
│  │  │ Spend    │ │  (Index) │                                │    │
│  │  └──────────┘ └──────────┘                                │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              API Routes (Next.js Server)                 │    │
│  │                                                          │    │
│  │  /api/import   /api/rules   /api/budgets                  │    │
│  │  /api/dashboard /api/safe-to-spend /api/export            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Shared Libraries (TypeScript)               │    │
│  │                                                          │    │
│  │  lib/csv/        lib/rules/       lib/budgets/            │    │
│  │  lib/import/     lib/safe-to-spend/                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              SQLite Database (better-sqlite3)            │    │
│  │                                                          │    │
│  │  accounts  transactions  rules  budgets  savings_goals   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Tauri Desktop Shell (Rust)                  │    │
│  │                                                          │    │
│  │  Native window, system tray, file system access           │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

- **Offline-first**: All data lives in a local SQLite database (`prisma/import.db`). No network requests are made for data operations.
- **Server-side database**: SQLite is accessed via `better-sqlite3` from Next.js API routes (server components). The database file is stored in the project root.
- **Rule engine**: Rules are sorted by priority (highest first). For each transaction, the first matching rule determines the category. Rules support regex, min/max amount filters, and direction filters (debit/credit/any).
- **WAL mode**: The SQLite database uses Write-Ahead Logging for better concurrency and crash recovery.
- **Sequential tests**: Vitest runs test files sequentially (`fileParallelism: false`) because multiple test files share and wipe the same database.

---

## Installation

### Prerequisites

- **Node.js** 22+
- **npm** 10+
- **Rust** 1.90+ (required for Tauri desktop builds)
- **System dependencies** (Linux / Debian-based):

  ```bash
  sudo apt install libwebkit2gtk-4.1-dev \
                   libssl2.0-dev \
                   libayatana-appindicator3-dev \
                   librsvg2-dev
  ```

- **System dependencies** (macOS):

  ```bash
  brew install webkitgtk openssl@3
  ```

- **System dependencies** (Windows): Install the [Tauri Windows prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites/#setting-up-windows) (Visual Studio Build Tools + WebView2).

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd sentry-ledger

# Install dependencies
npm install

# The database schema is auto-initialized on first API call.
# No manual migration step is required.
```

---

## Usage

### Importing Transactions

1. Navigate to the **Import** page (`/import`)
2. **Upload** — Drag and drop a CSV file or click to browse. The parser auto-detects the bank format (Chase, Bank of America, Wells Fargo, etc.)
3. **Map Columns** — The wizard suggests column mappings based on the detected bank profile. Adjust any mappings using the dropdowns. Columns that cannot be auto-mapped are marked as "Unmapped"
4. **Preview** — Review the parsed transactions. Duplicates are highlighted (amber for existing duplicates, green for new). Summary cards show total transactions, debits, credits, and duplicate count
5. **Commit** — Select an existing account or create a new one, then click "Import". Transactions are inserted with automatic duplicate detection (case-insensitive description + amount within $0.01 tolerance)

**Supported CSV formats:**
- MM/DD/YYYY, DD.MM.YYYY, YYYY-MM-DD, DD-MM-YYYY date formats
- USD, EUR, GBP currency formats
- Accounting parentheses for negatives: `(123.45)`
- US (1,234.56) and EU (1.234,56) thousands separators

### Managing Rules

1. Navigate to the **Rules** page (`/rules`)
2. **View rules** — Each rule card shows the name, regex pattern, target category, priority, amount filters, and active status
3. **Add a rule** — Click "Add Rule" to open the creation form:
   - **Name**: Display name for the rule
   - **Description**: Optional description
   - **Regex**: Regular expression matched against transaction descriptions (case-insensitive)
   - **Category**: Target category for matched transactions
   - **Priority**: Higher numbers are applied first (default: 100)
   - **Amount Direction**: Filter by debit, credit, or any (default: any)
   - **Min/Max Amount**: Optional amount range filter (absolute value)
   - **Active**: Toggle to enable/disable the rule without deleting it
4. **Test a rule** — Click "Test" on any rule card to see how many transactions it matches and preview the matched transactions
5. **Edit / Delete** — Use the edit button to modify a rule or the delete button to remove it
6. **Reorder** — Use the up/down arrows to adjust rule priority. Changes sync to the database immediately

**Built-in rules** (12 total):

| Rule | Category | Regex Pattern |
|------|----------|---------------|
| Groceries | Groceries | `grocery\|supermarket\|whole foods\|trader joe\|...` |
| Restaurants | Restaurants | `restaurant\|cafe\|coffee\|starbucks\|...` |
| Gas & Fuel | Gas & Fuel | `gas\|shell\|chevron\|bp\|...` |
| Transportation | Transportation | `uber\|lyft\|taxi\|transit\|...` |
| Utilities | Utilities | `electric\|water\|internet\|comcast\|...` |
| Insurance | Insurance | `insurance\|health plan\|auto insurance\|...` |
| Rent/Mortgage | Housing | `rent\|mortgage\|property tax\|homestead` |
| Streaming & Subscriptions | Subscriptions | `netflix\|spotify\|hulu\|disney\|...` |
| Pharmacy & Health | Health | `pharmacy\|cvs\|walgreens\|rite aid\|...` |
| Shopping | Shopping | `amazon\|walmart\|target\|costco\|...` |
| Income | Income | `salary\|payroll\|direct deposit\|...` (credit only) |
| Transfers | Transfers | `transfer\|transferred\|from \|to ` (priority: 50) |

### Setting Budgets

1. Navigate to the **Budgets** page (`/budgets`)
2. **Create a budget** — Click "Add Budget":
   - **Name**: Display name (e.g., "Monthly Dining")
   - **Category**: Select a category to track
   - **Amount**: Maximum spending for the period
   - **Period**: Weekly, Monthly, or Yearly
3. **Track progress** — Each budget shows a progress bar with spent vs. budgeted amounts
4. **Alerts**:
   - **Warning** (yellow): Spending has reached 80% of the budget
   - **Over budget** (red): Spending has exceeded the budget limit
5. **Edit / Delete** — Modify existing budgets or remove them

### Dashboard

The dashboard (`/dashboard`) provides a comprehensive overview of your finances:

- **Summary Cards**: Total Income, Total Expenses, Net Flow, Transaction Count, Unique Categories
- **Spending by Category**: Donut chart showing the proportion of spending per category
- **Monthly Spending Trend**: Area chart showing spending over time
- **Cash Flow**: Grouped bar chart comparing income, expenses, and net flow per month
- **Recent Transactions**: Last 20 transactions with date, description, amount, and category
- **Accounts**: List of all accounts with balances and types
- **Budgets**: Overview of all configured budgets with progress

### Safe-to-Spend

The safe-to-spend calculator (`/safe-to-spend`) answers the question: *"How much can I spend right now without going broke?"*

**Formula:**

```
safeToSpend = totalIncome - totalBills - totalBudgetedSpending - totalSavingsGoals
```

- **Total Income**: Sum of all positive (credit) transactions in the current month
- **Total Bills**: Sum of transactions marked as bills (negative amounts only)
- **Total Budgeted Spending**: Sum of all non-bill expenses in budgeted categories
- **Total Savings Goals**: Monthly contributions toward active savings goals

**Features:**
- **Daily breakdown**: Shows how much you can spend per day for the rest of the month
- **Deductions breakdown**: Visual progress bars showing what percentage of income goes to each category
- **Savings goals**: Create, edit, contribute to, and delete savings goals with deadlines
- **Warnings**: Alerts when you've exceeded your safe-to-spend amount or when less than 10% of income remains

### Exporting Data

Both CSV and PDF exports are available from the Dashboard and Import pages:

- **CSV Export** (`/api/export/csv`): Downloads all transactions as a CSV file with columns: Date, Description, Amount, Category, Is Bill, Is Duplicate, Account
- **PDF Export** (`/api/export/pdf`): Generates a comprehensive financial report including:
  - Summary statistics (income, expenses, net flow)
  - Spending by category breakdown
  - Cash flow chart
  - Monthly trends
  - Recent transactions table
  - Accounts list
  - Budgets overview
  - Savings goals

---

## Project Structure

```
sentry-ledger/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (Tailwind, theme provider)
│   │   ├── page.tsx                  # Home page (navigation to all features)
│   │   ├── globals.css               # Tailwind CSS with dark mode classes
│   │   │
│   │   ├── import/                   # Import page
│   │   │   └── page.tsx              # 4-step CSV import flow
│   │   │
│   │   ├── rules/                    # Rule management page
│   │   │   └── page.tsx              # CRUD UI for categorization rules
│   │   │
│   │   ├── budgets/                  # Budget management page
│   │   │   └── page.tsx              # Budget creation, progress, alerts
│   │   │
│   │   ├── dashboard/                # Dashboard page
│   │   │   └── page.tsx              # Charts, summary cards, recent txns
│   │   │
│   │   ├── safe-to-spend/            # Safe-to-spend calculator
│   │   │   └── page.tsx              # Spending calculator, savings goals
│   │   │
│   │   ├── api/                      # API routes
│   │   │   ├── import/
│   │   │   │   └── route.ts          # POST import, GET accounts
│   │   │   ├── rules/
│   │   │   │   └── route.ts          # CRUD rules, test, categories
│   │   │   ├── budgets/
│   │   │   │   └── route.ts          # CRUD budgets, calculate, categories
│   │   │   ├── dashboard/
│   │   │   │   └── route.ts          # Aggregated financial data
│   │   │   ├── safe-to-spend/
│   │   │   │   └── route.ts          # Calculate, daily, goals CRUD
│   │   │   └── export/
│   │   │       ├── csv/
│   │   │       │   └── route.ts      # CSV download
│   │   │       └── pdf/
│   │   │           └── route.ts      # PDF report generation
│   │   │
│   │   └── components/
│   │       └── ui/
│   │           ├── app-layout.tsx    # Shared navigation layout
│   │           ├── theme-provider.tsx # Light/dark/system theme
│   │           ├── theme-toggle.tsx  # Theme switcher button
│   │           └── index.ts          # Barrel export
│   │
│   └── lib/                          # Shared business logic
│       ├── csv/
│       │   ├── types.ts              # Core type definitions
│       │   ├── bank-profiles.ts      # 10 bank format profiles
│       │   ├── parser.ts             # CSV parsing, mapping, validation
│       │   └── index.ts              # Barrel export
│       │
│       ├── rules/
│       │   ├── engine.ts             # Rule matching, categorization, validation
│       │   ├── index.ts              # Barrel export
│       │   └── DEFAULT_RULES         # 12 built-in categorization rules
│       │
│       ├── budgets/
│       │   └── engine.ts             # Budget progress, alerts, aggregation
│       │
│       ├── import/
│       │   └── db.ts                 # SQLite operations (better-sqlite3)
│       │                               accounts, transactions, rules,
│       │                               budgets, savings_goals CRUD
│       │
│       └── safe-to-spend/
│           └── engine.ts             # Safe-to-spend calculation,
│                                       savings goal management, helpers
│
├── src-tauri/                        # Tauri 2 desktop app
│   ├── src/                          # Rust source
│   ├── tauri.conf.json               # App config (window, bundle, CSP)
│   ├── capabilities/                 # Security capabilities
│   └── icons/                        # App icons (32x32, 128x128, icns, ico)
│
├── tests/                            # Vitest test suite (315 tests)
│   ├── setup.ts                      # Test setup (temp DB, teardown)
│   ├── setup.test.ts                 # Setup verification
│   ├── csv-parser.test.ts            # CSV parser (47 tests)
│   ├── import-db.test.ts             # Import DB (20 tests)
│   ├── rule-engine.test.ts           # Rule engine (62 tests)
│   ├── rule-db.test.ts               # Rule DB CRUD (35 tests)
│   ├── budget-engine.test.ts         # Budget engine (33 tests)
│   ├── budget-db.test.ts             # Budget DB CRUD (18 tests)
│   ├── export-csv.test.ts            # CSV export (tests)
│   ├── export-pdf.test.ts            # PDF export (tests)
│   └── safe-to-spend-engine.test.ts  # Safe-to-spend (42 tests)
│
├── prisma/                           # Prisma configuration
│   ├── schema.prisma                 # Database schema (4 models)
│   └── migrations/                   # Migration history
│
├── public/                           # Static assets
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
├── vitest.config.ts                  # Vitest configuration
├── next.config.ts                    # Next.js configuration
├── postcss.config.mjs                # PostCSS configuration
└── README.md                         # This file
```

---

## Database Schema

The application uses SQLite with the following models (defined in `prisma/schema.prisma`):

### Account

| Column | Type | Description |
|--------|------|-------------|
| `id` | String (cuid) | Primary key |
| `name` | String | Account name (e.g., "Main Checking") |
| `type` | String | checking / savings / credit / cash / investment / other |
| `balance` | Float | Current balance (default: 0) |
| `currency` | String | ISO currency code (default: "USD") |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### Transaction

| Column | Type | Description |
|--------|------|-------------|
| `id` | String (cuid) | Primary key |
| `accountId` | String (FK) | Reference to Account (cascade delete) |
| `date` | DateTime | Transaction date |
| `description` | String | Transaction description / memo |
| `amount` | Float | Positive = income, negative = expense |
| `category` | String? | Auto-categorized or manually set |
| `ruleId` | String? (FK) | Rule that categorized this transaction |
| `isBill` | Boolean | Marked as a recurring bill |
| `isDuplicate` | Boolean | Detected as a duplicate |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Indexes:** `accountId + date`, `category`, `isBill`, `isDuplicate`

### Rule

| Column | Type | Description |
|--------|------|-------------|
| `id` | String (cuid) | Primary key |
| `name` | String | Display name |
| `description` | String | Optional description |
| `regex` | String | Regex pattern for matching descriptions |
| `category` | String | Target category |
| `priority` | Int | Higher = applied first (default: 0) |
| `isActive` | Boolean | Enable/disable (default: true) |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Indexes:** `priority`, `isActive`

### Budget

| Column | Type | Description |
|--------|------|-------------|
| `id` | String (cuid) | Primary key |
| `name` | String | Display name |
| `categoryId` | String | Category this budget tracks |
| `amount` | Float | Budget limit |
| `period` | String | weekly / monthly / yearly |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Index:** `categoryId`

### Savings Goal

| Column | Type | Description |
|--------|------|-------------|
| `id` | String (cuid) | Primary key |
| `name` | String | Goal name |
| `targetAmount` | Float | Target savings amount |
| `currentAmount` | Float | Current saved amount |
| `deadline` | DateTime? | Optional deadline date |
| `monthlyContribution` | Float | Monthly contribution amount |
| `isActive` | Boolean | Active/inactive (default: true) |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

---

## API Reference

All API routes are under `/api/` and use JSON responses.

### Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/import` | Import transactions from CSV. Body: `{ csvContent, fileName, bankProfile, columnMapping, accountId }`. Returns: `{ imported, duplicates, failed, transactions }` |
| `GET` | `/api/import` | List all accounts. Returns: `{ accounts }` |

### Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rules` | List all rules. Returns: `{ rules }` |
| `GET` | `/api/rules?action=categories` | Get unique categories. Returns: `{ categories }` |
| `GET` | `/api/rules?action=test` | Test a rule against sample transactions. Query: `?id=...&sample=...`. Returns: `{ matches, total, matchedTransactions }` |
| `GET` | `/api/rules?action=default` | Get built-in default rules. Returns: `{ rules }` |
| `POST` | `/api/rules` | Create a new rule. Body: `{ name, regex, category, priority, description, minAmount, maxAmount, amountDirection, isActive }` |
| `PUT` | `/api/rules?id=<id>` | Update an existing rule. Body: partial rule object |
| `DELETE` | `/api/rules?id=<id>` | Delete a rule by ID |
| `PATCH` | `/api/rules` | Reorder rules (batch priority updates). Body: `{ ruleIds: [{ id, priority }] }` |

### Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/budgets` | List all budgets. Returns: `{ budgets }` |
| `GET` | `/api/budgets?action=calculate` | Calculate full budget summary with alerts. Query: `?month=<YYYY-MM>`. Returns: `{ totalBudgeted, totalSpent, remaining, categoryBreakdown, alerts }` |
| `GET` | `/api/budgets?action=categories` | Get unique categories. Returns: `{ categories }` |
| `POST` | `/api/budgets` | Create a new budget. Body: `{ name, categoryId, amount, period }` |
| `PUT` | `/api/budgets?id=<id>` | Update an existing budget. Body: partial budget object |
| `DELETE` | `/api/budgets?id=<id>` | Delete a budget by ID |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard?month=<YYYY-MM>` | Get aggregated financial data. Returns: `{ summary, spendingByCategory, monthlyTrends, cashFlow, recentTransactions, accounts, budgets }` |

### Safe-to-Spend

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/safe-to-spend` | Calculate safe-to-spend for current month. Returns: `{ totalIncome, totalBills, totalBudgetedSpending, totalSavingsGoals, safeToSpend, safeToSpendPercent, deductions, isSafe, warning }` |
| `GET` | `/api/safe-to-spend?action=daily` | Get daily safe-to-spend amount. Returns: `{ dailyAmount, daysRemaining, totalSafe }` |
| `GET` | `/api/safe-to-spend?action=goals` | List all savings goals. Returns: `{ goals }` |
| `POST` | `/api/safe-to-spend?action=goals` | Create a savings goal. Body: `{ name, targetAmount, currentAmount, deadline, monthlyContribution }` |
| `PUT` | `/api/safe-to-spend?action=goals&id=<id>` | Update a savings goal. Body: partial goal object |
| `DELETE` | `/api/safe-to-spend?action=goals&id=<id>` | Delete a savings goal by ID |

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/export/csv` | Download all transactions as CSV. Response: `text/csv` attachment |
| `GET` | `/api/export/pdf` | Download comprehensive financial report as PDF. Response: `application/pdf` attachment |

---

## Testing

The project includes 315 tests across 11 test files, all passing with 0 failures.

```bash
# Run all tests (sequential, no parallel workers)
npm run test

# Watch mode (re-runs on file changes)
npm run test:watch
```

**Test coverage by module:**

| Test File | Tests | Module |
|-----------|-------|--------|
| `csv-parser.test.ts` | 47 | CSV parsing, bank profile detection, column mapping, date/amount parsing |
| `rule-engine.test.ts` | 62 | Rule matching, priority ordering, amount filters, bill detection, validation |
| `rule-db.test.ts` | 35 | Rule CRUD, reordering, category listing, default rules |
| `budget-engine.test.ts` | 33 | Budget progress, alerts, category breakdown, date ranges, rounding |
| `budget-db.test.ts` | 18 | Budget CRUD, calculation, category listing |
| `import-db.test.ts` | 20 | Transaction import, duplicate detection, account management |
| `safe-to-spend-engine.test.ts` | 42 | Safe-to-spend calculation, daily breakdown, savings goals, validation |
| `export-csv.test.ts` | — | CSV export functionality |
| `export-pdf.test.ts` | — | PDF report generation |
| `api-routes.test.ts` | — | API route integration tests |
| `setup.test.ts` | — | Test infrastructure verification |

**Test notes:**
- Tests use a temporary SQLite database in the OS temp directory (created per-test and cleaned up afterward)
- Tests run sequentially (`fileParallelism: false`) to avoid race conditions on the shared database
- The test setup file (`tests/setup.ts`) handles database creation, seeding, and teardown

---

## Building

### Web Application

```bash
# Production build (static export)
npm run build
```

Output is placed in `.output/`.

### Desktop Application

```bash
# Build desktop binaries
npm run tauri build
```

This compiles the Rust backend and bundles the Next.js frontend into a native desktop application.

**Output binaries (Linux):**

| Format | File | Size |
|--------|------|------|
| **deb** | `src-tauri/target/release/bundle/deb/SentryLedger_0.1.0_amd64.deb` | ~5.8 MiB |
| **rpm** | `src-tauri/target/release/bundle/rpm/SentryLedger-0.1.0-1.x86_64.rpm` | ~5.8 MiB |
| **AppImage** | `src-tauri/target/release/bundle/appimage/SentryLedger_0.1.0_amd64.AppImage` | ~97 MiB |

> **Cross-compilation:** Building Windows (`.exe`) or macOS (`.dmg`) binaries requires a native Windows or macOS build environment respectively, or cross-compilation toolchains (mingw-w64 for Windows, macOS SDK for macOS). On Linux, only Linux bundles are produced.

---

## Configuration

### Environment Variables

Create a `.env` file in the `sentry-ledger/` directory:

```env
# Database path (relative to project root)
DATABASE_URL=file:./prisma/import.db
```

### Tauri Configuration

`src-tauri/tauri.conf.json`:

```json
{
  "productName": "SentryLedger",
  "version": "0.1.0",
  "identifier": "com.sentryledger",
  "build": {
    "frontendDist": "../.output",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "SentryLedger",
        "width": 800,
        "height": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

### Vitest Configuration

`vitest.config.ts`:

- **Environment**: `node` (jsdom is not used — all tests are server-side)
- **Sequential execution**: `fileParallelism: false` and `sequence: { concurrent: false }` to prevent database conflicts
- **Setup file**: `tests/setup.ts` (creates temp database, seeds data, cleans up)
- **Test include**: `tests/**/*.test.ts`

---

## License

MIT
