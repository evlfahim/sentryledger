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
- **Export** to CSV and PDF reports
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
│   │   ├── page.tsx      # Home page
│   │   └── globals.css   # Tailwind CSS with dark mode
│   ├── components/       # Reusable UI components
│   └── lib/              # Shared utilities
├── src-tauri/            # Tauri Rust backend
│   ├── src/              # Rust source code
│   ├── tauri.conf.json   # Tauri configuration
│   └── capabilities/     # App security capabilities
├── tests/                # Vitest test files
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
│  │  │  Page   │ │  Editor │ │  Chart  │ │  │
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

## License

MIT
