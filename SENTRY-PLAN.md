# SentryLedger

> A secure, offline-first desktop finance tracker that auto-categorizes bank CSVs via editable rules, visualizes budgets with charts, and calculates safe-to-spend amounts, all running locally with zero cloud dependency.

Task: Personal finance tracker that imports bank CSV files, auto-categorizes spending with editable rules, and shows monthly charts and budgets, all offline #web #desktop

## Why it is better than what exists
- Replaces complex cloud stacks with a lightweight Tauri+SQLite architecture for instant startup and true privacy.
- Improves rule management with a visual, priority-based editor compared to text-file configs.
- Adds safe-to-spend forecasting and bill detection missing in basic CSV tools.
- Provides a polished desktop experience unlike CLI-only alternatives.
- Avoids heavy dependencies like MongoDB or Agentic AI, ensuring fast performance and no external API calls.

## Features
- CSV/OFX import with automatic bank profile detection and column mapping wizard
- Visual rule builder with regex support, priority ordering, and live preview
- Monthly budgets with real-time progress tracking and alerts
- Interactive charts for spending by category, trend analysis, and cash flow
- Safe-to-spend calculator based on income, bills, and savings goals
- Duplicate detection and transaction linking between accounts
- Encrypted local SQLite database with backup/restore
- Export to CSV and PDF reports
- Dark mode and responsive layout
- One-click desktop installer for Windows, macOS, and Linux

## Stack
TypeScript, Next.js, Tauri, SQLite (Prisma), Tailwind CSS, Recharts, Shadcn/UI, Vitest

## Steps
- [x] 1. Scaffold Tauri project with Next.js, configure Vitest, and verify dev server and build pipeline.
- [ ] 2. Define Prisma schema for accounts, transactions, rules, and budgets, then run migration.
- [ ] 3. Implement CSV parser with auto-detection of bank formats and column mapping wizard.
- [ ] 4. Build import page with transaction preview, duplicate checking, and commit action.
- [ ] 5. Create rule engine that applies categorized rules to transactions based on description and amount.
- [ ] 6. Develop rule management UI allowing users to add, edit, reorder, and test rules.
- [ ] 7. Implement budget creation form and calculate remaining balance against imported transactions.
- [ ] 8. Add dashboard with Recharts visualizations for monthly spending breakdown and trends.
- [ ] 9. Integrate safe-to-spend logic that subtracts bills and goals from available income.
- [ ] 10. Polish UI with Shadcn components, dark mode toggle, and responsive design.
- [ ] 11. Add export functionality to download transactions as CSV and dashboard as PDF.
- [ ] 12. Write unit tests for parser, rule engine, and budget calculations, then run suite.
- [ ] 13. Build production desktop binary for Windows, macOS, and Linux.
- [ ] 14. Write comprehensive README with installation, usage guide, and architecture overview.
