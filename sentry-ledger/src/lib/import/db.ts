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
      min_amount REAL,
      max_amount REAL,
      amount_direction TEXT DEFAULT 'any',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id TEXT NOT NULL,
      amount REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL DEFAULT 0,
      current_amount REAL NOT NULL DEFAULT 0,
      monthly_contribution REAL NOT NULL DEFAULT 0,
      deadline TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
  `);

  // Schema migration: add new columns to rules table if they don't exist
  migrateSchema(db);
}

/**
 * Migrate the rules table schema to include new columns.
 * SQLite doesn't support ALTER TABLE IF NOT EXISTS, so we check and add manually.
 */
function migrateSchema(db: Database.Database): void {
  try {
    // Check if min_amount column exists by querying the table
    const pragmaResult = db.prepare("PRAGMA table_info(rules)").all() as { name: string }[];
    const columnNames = pragmaResult.map((c) => c.name);

    if (!columnNames.includes("min_amount")) {
      db.exec("ALTER TABLE rules ADD COLUMN min_amount REAL");
    }
    if (!columnNames.includes("max_amount")) {
      db.exec("ALTER TABLE rules ADD COLUMN max_amount REAL");
    }
    if (!columnNames.includes("amount_direction")) {
      db.exec("ALTER TABLE rules ADD COLUMN amount_direction TEXT DEFAULT 'any'");
    }
  } catch {
    // If ALTER TABLE fails (e.g., column already exists despite pragma check),
    // silently ignore — the table is fine.
  }
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
    is_bill?: number;
  }[]
): { imported: number; duplicates: number; failed: number } {
  if (!accountExists(accountId)) {
    throw new Error(`Account ${accountId} does not exist`);
  }

  const db = getDb();
  const insertStmt = db.prepare(
    `INSERT INTO transactions (id, account_id, date, description, amount, category, is_bill, is_duplicate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  );

  const dupStmt = db.prepare(
    `INSERT INTO transactions (id, account_id, date, description, amount, category, is_bill, is_duplicate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
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
        const isBill = tx.is_bill ?? 0;

        // Check for existing duplicate
        const existing = checkDup.get(dateStr, tx.description, tx.amount, accountId) as { id: string } | undefined;

        if (existing) {
          dupStmt.run(
            crypto.randomUUID(),
            accountId,
            dateStr,
            tx.description,
            tx.amount,
            tx.category || null,
            isBill
          );
          duplicates++;
        } else {
          insertStmt.run(
            crypto.randomUUID(),
            accountId,
            dateStr,
            tx.description,
            tx.amount,
            tx.category || null,
            isBill,
            0
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
 * Get all transactions across all accounts, with pagination.
 */
export function getAllTransactions(
  limit: number = 10000,
  offset: number = 0
): TransactionRow[] {
  const stmt = getDb().prepare(
    "SELECT * FROM transactions ORDER BY date DESC LIMIT ? OFFSET ?"
  );
  return stmt.all(limit, offset) as TransactionRow[];
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
  getDb().exec("DELETE FROM budgets");
  getDb().exec("DELETE FROM savings_goals");
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

// ─── Rule Operations ──────────────────────────────────────────────────────────

export interface RuleRow {
  id: string;
  name: string;
  description: string;
  regex: string;
  category: string;
  priority: number;
  is_active: number;
  min_amount: number | null;
  max_amount: number | null;
  amount_direction: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get all rules, ordered by priority descending.
 */
export function getRules(): RuleRow[] {
  const stmt = getDb().prepare(
    "SELECT * FROM rules ORDER BY priority DESC, created_at ASC"
  );
  return stmt.all() as RuleRow[];
}

/**
 * Get a single rule by ID.
 */
export function getRule(id: string): RuleRow | undefined {
  const stmt = getDb().prepare("SELECT * FROM rules WHERE id = ?");
  return stmt.get(id) as RuleRow | undefined;
}

/**
 * Create a new rule.
 */
export function createRule(
  name: string,
  regex: string,
  category: string,
  description: string = "",
  priority: number = 0,
  isActive: boolean = true,
  minAmount: number | null = null,
  maxAmount: number | null = null,
  amountDirection: string = "any"
): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const stmt = getDb().prepare(
    `INSERT INTO rules (id, name, description, regex, category, priority, is_active, min_amount, max_amount, amount_direction, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    id,
    name,
    description,
    regex,
    category,
    priority,
    isActive ? 1 : 0,
    minAmount,
    maxAmount,
    amountDirection,
    now,
    now
  );
  return id;
}

/**
 * Update an existing rule.
 */
export function updateRule(
  id: string,
  updates: {
    name?: string;
    description?: string;
    regex?: string;
    category?: string;
    priority?: number;
    isActive?: boolean;
    minAmount?: number | null;
    maxAmount?: number | null;
    amountDirection?: string;
  }
): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.regex !== undefined) {
    fields.push("regex = ?");
    values.push(updates.regex);
  }
  if (updates.category !== undefined) {
    fields.push("category = ?");
    values.push(updates.category);
  }
  if (updates.priority !== undefined) {
    fields.push("priority = ?");
    values.push(updates.priority);
  }
  if (updates.isActive !== undefined) {
    fields.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }
  if (updates.minAmount !== undefined) {
    fields.push("min_amount = ?");
    values.push(updates.minAmount);
  }
  if (updates.maxAmount !== undefined) {
    fields.push("max_amount = ?");
    values.push(updates.maxAmount);
  }
  if (updates.amountDirection !== undefined) {
    fields.push("amount_direction = ?");
    values.push(updates.amountDirection);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = getDb().prepare(
    `UPDATE rules SET ${fields.join(", ")} WHERE id = ?`
  );
  stmt.run(...values);
}

/**
 * Delete a rule by ID.
 */
export function deleteRule(id: string): void {
  const stmt = getDb().prepare("DELETE FROM rules WHERE id = ?");
  stmt.run(id);
}

/**
 * Reorder rules by setting their priorities.
 * Expects an array of { id, priority } objects.
 */
export function reorderRules(updates: { id: string; priority: number }[]): void {
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE rules SET priority = ?, updated_at = ? WHERE id = ?"
  );
  const now = new Date().toISOString();
  const batch = db.transaction((items) => {
    for (const item of items) {
      stmt.run(item.priority, now, item.id);
    }
  });
  batch(updates);
}

/**
 * Get all unique categories from rules.
 */
export function getCategories(): string[] {
  const stmt = getDb().prepare("SELECT DISTINCT category FROM rules ORDER BY category");
  return (stmt.all() as { category: string }[]).map((r) => r.category);
}

/**
 * Clear all rules (for testing).
 */
export function clearRules(): void {
  getDb().exec("DELETE FROM rules");
}

// ─── Budget Operations ────────────────────────────────────────────────────────

export interface BudgetRow {
  id: string;
  name: string;
  category_id: string;
  amount: number;
  period: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all budgets, ordered by name.
 */
export function getBudgets(): BudgetRow[] {
  const stmt = getDb().prepare(
    "SELECT * FROM budgets ORDER BY name"
  );
  return stmt.all() as BudgetRow[];
}

/**
 * Get a single budget by ID.
 */
export function getBudget(id: string): BudgetRow | undefined {
  const stmt = getDb().prepare("SELECT * FROM budgets WHERE id = ?");
  return stmt.get(id) as BudgetRow | undefined;
}

/**
 * Create a new budget.
 */
export function createBudget(
  name: string,
  categoryId: string,
  amount: number,
  period: string = "monthly"
): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const stmt = getDb().prepare(
    `INSERT INTO budgets (id, name, category_id, amount, period, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(id, name, categoryId, amount, period, now, now);
  return id;
}

/**
 * Update an existing budget.
 */
export function updateBudget(
  id: string,
  updates: {
    name?: string;
    categoryId?: string;
    amount?: number;
    period?: string;
  }
): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.categoryId !== undefined) {
    fields.push("category_id = ?");
    values.push(updates.categoryId);
  }
  if (updates.amount !== undefined) {
    fields.push("amount = ?");
    values.push(updates.amount);
  }
  if (updates.period !== undefined) {
    fields.push("period = ?");
    values.push(updates.period);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = getDb().prepare(
    `UPDATE budgets SET ${fields.join(", ")} WHERE id = ?`
  );
  stmt.run(...values);
}

/**
 * Delete a budget by ID.
 */
export function deleteBudget(id: string): void {
  const stmt = getDb().prepare("DELETE FROM budgets WHERE id = ?");
  stmt.run(id);
}

/**
 * Clear all budgets (for testing).
 */
export function clearBudgets(): void {
  getDb().exec("DELETE FROM budgets");
}

// ─── Savings Goals Operations ─────────────────────────────────────────────────

export interface SavingsGoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  deadline: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get all savings goals, ordered by name.
 */
export function getSavingsGoals(): SavingsGoalRow[] {
  const stmt = getDb().prepare(
    "SELECT * FROM savings_goals ORDER BY name"
  );
  return stmt.all() as SavingsGoalRow[];
}

/**
 * Get a single savings goal by ID.
 */
export function getSavingsGoal(id: string): SavingsGoalRow | undefined {
  const stmt = getDb().prepare("SELECT * FROM savings_goals WHERE id = ?");
  return stmt.get(id) as SavingsGoalRow | undefined;
}

/**
 * Get active savings goals only.
 */
export function getActiveSavingsGoals(): SavingsGoalRow[] {
  const stmt = getDb().prepare(
    "SELECT * FROM savings_goals WHERE is_active = 1 ORDER BY name"
  );
  return stmt.all() as SavingsGoalRow[];
}

/**
 * Create a new savings goal.
 */
export function createSavingsGoal(
  name: string,
  targetAmount: number,
  currentAmount: number = 0,
  monthlyContribution: number = 0,
  deadline: string | null = null,
  isActive: boolean = true
): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const stmt = getDb().prepare(
    `INSERT INTO savings_goals (id, name, target_amount, current_amount, monthly_contribution, deadline, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(id, name, targetAmount, currentAmount, monthlyContribution, deadline, isActive ? 1 : 0, now, now);
  return id;
}

/**
 * Update an existing savings goal.
 */
export function updateSavingsGoal(
  id: string,
  updates: {
    name?: string;
    targetAmount?: number;
    currentAmount?: number;
    monthlyContribution?: number;
    deadline?: string | null;
    isActive?: boolean;
  }
): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.targetAmount !== undefined) {
    fields.push("target_amount = ?");
    values.push(updates.targetAmount);
  }
  if (updates.currentAmount !== undefined) {
    fields.push("current_amount = ?");
    values.push(updates.currentAmount);
  }
  if (updates.monthlyContribution !== undefined) {
    fields.push("monthly_contribution = ?");
    values.push(updates.monthlyContribution);
  }
  if (updates.deadline !== undefined) {
    fields.push("deadline = ?");
    values.push(updates.deadline);
  }
  if (updates.isActive !== undefined) {
    fields.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = getDb().prepare(
    `UPDATE savings_goals SET ${fields.join(", ")} WHERE id = ?`
  );
  stmt.run(...values);
}

/**
 * Delete a savings goal by ID.
 */
export function deleteSavingsGoal(id: string): void {
  const stmt = getDb().prepare("DELETE FROM savings_goals WHERE id = ?");
  stmt.run(id);
}

/**
 * Clear all savings goals (for testing).
 */
export function clearSavingsGoals(): void {
  getDb().exec("DELETE FROM savings_goals");
}
