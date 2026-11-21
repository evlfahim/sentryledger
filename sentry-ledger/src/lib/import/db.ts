/**
 * Database utilities for the import feature.
 *
 * Uses better-sqlite3 for local SQLite operations.
 * All DB paths are resolved relative to the project root.
 *
 * This module is server-only and should only be imported from API routes
 * or server actions, never from client components.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Resolve DB path relative to project root
const DB_DIR = path.join(__dirname, "../../../../prisma");
const DB_PATH = path.join(DB_DIR, "import.db");

// Ensure directory exists
fs.mkdirSync(DB_DIR, { recursive: true });

let db: Database.Database | null = null;

/**
 * Get or create the database connection.
 */
function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

/**
 * Initialize the database schema.
 */
function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'checking',
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      rule_id TEXT,
      is_bill INTEGER NOT NULL DEFAULT 0,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      regex TEXT NOT NULL,
      category TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_transactions_is_bill ON transactions(is_bill);
    CREATE INDEX IF NOT EXISTS idx_transactions_is_duplicate ON transactions(is_duplicate);
    CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority);
    CREATE INDEX IF NOT EXISTS idx_rules_is_active ON rules(is_active);
  `);
}

// ─── Account Operations ───────────────────────────────────────────────────────

export interface AccountRow {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all accounts.
 */
export function getAccounts(): AccountRow[] {
  const stmt = getDb().prepare(
    "SELECT * FROM accounts ORDER BY name"
  );
  return stmt.all() as AccountRow[];
}

/**
 * Create a new account.
 */
export function createAccount(
  name: string,
  type: string = "checking",
  balance: number = 0,
  currency: string = "USD"
): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const stmt = getDb().prepare(
    "INSERT INTO accounts (id, name, type, balance, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  stmt.run(id, name, type, balance, currency, now, now);
  return id;
}

/**
 * Check if an account exists by ID.
 */
export function accountExists(id: string): boolean {
  const stmt = getDb().prepare("SELECT 1 FROM accounts WHERE id = ? LIMIT 1");
  return stmt.get(id) !== undefined;
}

// ─── Transaction Operations ───────────────────────────────────────────────────

export interface TransactionRow {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  rule_id: string | null;
  is_bill: number;
  is_duplicate: number;
  created_at: string;
  updated_at: string;
}

/**
 * Check if a transaction already exists (duplicate detection against DB).
 * Returns existing transaction if found, null otherwise.
 */
export function findExistingDuplicate(
  date: string,
  description: string,
  amount: number,
  accountId: string
): TransactionRow | null {
  const dateStr = new Date(date).toISOString().split("T")[0];
  const stmt = getDb().prepare(
    `SELECT * FROM transactions 
     WHERE date = ? 
       AND LOWER(description) = LOWER(?) 
       AND ABS(amount - ?) < 0.01
       AND account_id = ?
       AND is_duplicate = 0
     LIMIT 1`
  );
  const result = stmt.get(dateStr, description, amount, accountId) as TransactionRow | undefined;
  return result || null;
}

/**
 * Import transactions into the database.
 * Returns stats about the import.
 */
export function importTransactions(
  accountId: string,
  transactions: {
    date: string;
    description: string;
    amount: number;
    category?: string;
  }[]
): { imported: number; duplicates: number; failed: number } {
  if (!accountExists(accountId)) {
    throw new Error(`Account ${accountId} does not exist`);
  }

  const db = getDb();
  const insertStmt = db.prepare(
    `INSERT INTO transactions (id, account_id, date, description, amount, category, is_bill, is_duplicate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, datetime('now'), datetime('now'))`
  );

  const dupStmt = db.prepare(
    `INSERT INTO transactions (id, account_id, date, description, amount, category, is_bill, is_duplicate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1, datetime('now'), datetime('now'))`
  );

  const checkDup = db.prepare(
    `SELECT id FROM transactions 
     WHERE date = ? 
       AND LOWER(description) = LOWER(?) 
       AND ABS(amount - ?) < 0.01
       AND account_id = ?
       AND is_duplicate = 0
     LIMIT 1`
  );

  let imported = 0;
  let duplicates = 0;
  let failed = 0;

  const batch = db.transaction((txs) => {
    for (const tx of txs) {
      try {
        const dateStr = new Date(tx.date).toISOString().split("T")[0];

        // Check for existing duplicate
        const existing = checkDup.get(dateStr, tx.description, tx.amount, accountId) as { id: string } | undefined;

        if (existing) {
          dupStmt.run(
            crypto.randomUUID(),
            accountId,
            dateStr,
            tx.description,
            tx.amount,
            tx.category || null
          );
          duplicates++;
        } else {
          insertStmt.run(
            crypto.randomUUID(),
            accountId,
            dateStr,
            tx.description,
            tx.amount,
            tx.category || null
          );
          imported++;
        }
      } catch {
        failed++;
      }
    }
  });

  batch(transactions);

  return { imported, duplicates, failed };
}

/**
 * Get transactions for an account, with pagination.
 */
export function getTransactions(
  accountId: string,
  limit: number = 100,
  offset: number = 0
): TransactionRow[] {
  const stmt = getDb().prepare(
    "SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC LIMIT ? OFFSET ?"
  );
  return stmt.all(accountId, limit, offset) as TransactionRow[];
}

/**
 * Get total transaction count for an account.
 */
export function getTransactionCount(accountId: string): number {
  const stmt = getDb().prepare(
    "SELECT COUNT(*) as count FROM transactions WHERE account_id = ?"
  );
  const result = stmt.get(accountId) as { count: number };
  return result.count;
}

/**
 * Get transaction statistics for an account.
 */
export function getTransactionStats(accountId: string): {
  totalTransactions: number;
  totalDebits: number;
  totalCredits: number;
  netFlow: number;
  duplicateCount: number;
} {
  const stmt = getDb().prepare(
    `SELECT 
       COUNT(*) as totalTransactions,
       COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) as totalDebits,
       COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as totalCredits,
       COALESCE(SUM(amount), 0) as netFlow,
       SUM(is_duplicate) as duplicateCount
     FROM transactions 
     WHERE account_id = ?`
  );
  return stmt.get(accountId) as {
    totalTransactions: number;
    totalDebits: number;
    totalCredits: number;
    netFlow: number;
    duplicateCount: number;
  };
}

/**
 * Clear all transactions (for testing).
 */
export function clearTransactions(): void {
  getDb().exec("DELETE FROM transactions");
}

/**
 * Clear all data (for testing).
 */
export function clearAll(): void {
  getDb().exec("DELETE FROM transactions");
  getDb().exec("DELETE FROM rules");
  getDb().exec("DELETE FROM accounts");
}

/**
 * Close the database connection.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
