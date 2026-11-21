/**
 * Budget calculation engine.
 *
 * Computes budget progress, remaining balance, and overspending alerts
 * based on imported transactions and budget definitions.
 */

import type { BudgetRow, TransactionRow } from "@/lib/import/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BudgetCategorySummary {
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  isOver: boolean;
  transactionCount: number;
}

export interface BudgetSummary {
  budget: BudgetRow;
  categorySummary: BudgetCategorySummary;
  alertLevel: "ok" | "warning" | "over";
}

export interface OverallBudgetSummary {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  overallPercentage: number;
  budgets: BudgetSummary[];
  categoryBreakdown: BudgetCategorySummary[];
  alerts: {
    level: "warning" | "over";
    message: string;
    categoryId: string;
    categoryName: string;
    budgeted: number;
    spent: number;
    overAmount: number;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the first day of the month for a given date.
 */
function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the last day of the month for a given date.
 */
function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Format a number as currency.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Format a percentage with one decimal place.
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

/**
 * Check if a transaction falls within a date range.
 */
function isInDateRange(txDate: Date, start: Date, end: Date): boolean {
  return txDate >= start && txDate <= end;
}

/**
 * Calculate spending for a specific category within a date range.
 */
function calculateCategorySpending(
  transactions: TransactionRow[],
  categoryId: string,
  monthStart: Date,
  monthEnd: Date
): {
  spent: number;
  transactionCount: number;
} {
  const filtered = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return (
      tx.category === categoryId &&
      isInDateRange(txDate, monthStart, monthEnd)
    );
  });

  const spent = filtered
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return {
    spent: Math.round(spent * 100) / 100,
    transactionCount: filtered.length,
  };
}

/**
 * Calculate budget progress for a single budget.
 */
export function calculateBudgetProgress(
  budget: BudgetRow,
  transactions: TransactionRow[],
  period: "current" | "custom" = "current",
  customStart?: Date,
  customEnd?: Date
): BudgetSummary {
  const now = new Date();
  let monthStart: Date;
  let monthEnd: Date;

  if (period === "custom" && customStart && customEnd) {
    monthStart = customStart;
    monthEnd = customEnd;
  } else {
    monthStart = getMonthStart(now);
    monthEnd = getMonthEnd(now);
  }

  const { spent, transactionCount } = calculateCategorySpending(
    transactions,
    budget.category_id,
    monthStart,
    monthEnd
  );

  const budgeted = budget.amount;
  const remaining = budgeted - spent;
  const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const isOver = spent > budgeted;

  let alertLevel: "ok" | "warning" | "over" = "ok";
  if (isOver) {
    alertLevel = "over";
  } else if (percentage >= 80) {
    alertLevel = "warning";
  }

  return {
    budget,
    categorySummary: {
      category: budget.category_id,
      budgeted,
      spent,
      remaining,
      percentage: Math.round(percentage * 10) / 10,
      isOver,
      transactionCount,
    },
    alertLevel,
  };
}

/**
 * Calculate overall budget summary across all budgets.
 */
export function calculateOverallBudget(
  budgets: BudgetRow[],
  transactions: TransactionRow[],
  period: "current" | "custom" = "current",
  customStart?: Date,
  customEnd?: Date
): OverallBudgetSummary {
  const budgetSummaries: BudgetSummary[] = [];
  const alerts: OverallBudgetSummary["alerts"] = [];

  for (const budget of budgets) {
    const summary = calculateBudgetProgress(
      budget,
      transactions,
      period,
      customStart,
      customEnd
    );
    budgetSummaries.push(summary);

    if (summary.alertLevel === "over") {
      alerts.push({
        level: "over",
        message: `Over budget by ${formatCurrency(summary.categorySummary.spent - summary.categorySummary.budgeted)} in ${summary.categorySummary.category}`,
        categoryId: summary.budget.category_id,
        categoryName: summary.categorySummary.category,
        budgeted: summary.categorySummary.budgeted,
        spent: summary.categorySummary.spent,
        overAmount: summary.categorySummary.spent - summary.categorySummary.budgeted,
      });
    } else if (summary.alertLevel === "warning") {
      alerts.push({
        level: "warning",
        message: `Approaching budget limit (${formatPercent(summary.categorySummary.percentage)}) in ${summary.categorySummary.category}`,
        categoryId: summary.budget.category_id,
        categoryName: summary.categorySummary.category,
        budgeted: summary.categorySummary.budgeted,
        spent: summary.categorySummary.spent,
        overAmount: 0,
      });
    }
  }

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgetSummaries.reduce(
    (sum, s) => sum + s.categorySummary.spent,
    0
  );
  const totalRemaining = totalBudgeted - totalSpent;
  const overallPercentage =
    totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  // Category breakdown: aggregate all spending by category
  const now = new Date();
  let csStart: Date;
  let csEnd: Date;
  if (period === "custom" && customStart && customEnd) {
    csStart = customStart;
    csEnd = customEnd;
  } else {
    csStart = getMonthStart(now);
    csEnd = getMonthEnd(now);
  }

  const categoryMap = new Map<
    string,
    { spent: number; transactionCount: number }
  >();

  for (const tx of transactions) {
    if (!tx.category) continue;
    const txDate = new Date(tx.date);
    if (!isInDateRange(txDate, csStart, csEnd)) continue;
    if (tx.amount >= 0) continue; // only debits

    const existing = categoryMap.get(tx.category);
    if (existing) {
      existing.spent += Math.abs(tx.amount);
      existing.transactionCount += 1;
    } else {
      categoryMap.set(tx.category, {
        spent: Math.abs(tx.amount),
        transactionCount: 1,
      });
    }
  }

  const categoryBreakdown: BudgetCategorySummary[] = Array.from(
    categoryMap.entries()
  )
    .map(([category, data]) => {
      const budgeted = budgets.find((b) => b.category_id === category)?.amount || 0;
      return {
        category,
        budgeted,
        spent: Math.round(data.spent * 100) / 100,
        remaining: budgeted - data.spent,
        percentage: budgeted > 0 ? Math.round((data.spent / budgeted) * 1000) / 10 : 0,
        isOver: data.spent > budgeted,
        transactionCount: data.transactionCount,
      };
    })
    .sort((a, b) => b.spent - a.spent);

  return {
    totalBudgeted: Math.round(totalBudgeted * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalRemaining: Math.round(totalRemaining * 100) / 100,
    overallPercentage: Math.round(overallPercentage * 10) / 10,
    budgets: budgetSummaries,
    categoryBreakdown,
    alerts,
  };
}

// ─── Budget CRUD helpers (used by API route) ─────────────────────────────────

export interface CreateBudgetInput {
  name: string;
  categoryId: string;
  amount: number;
  period: "weekly" | "monthly" | "yearly";
}

export interface UpdateBudgetInput {
  name?: string;
  categoryId?: string;
  amount?: number;
  period?: "weekly" | "monthly" | "yearly";
}

/**
 * Validate a budget creation input.
 */
export function validateBudget(
  input: CreateBudgetInput
): string[] {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push("Budget name is required");
  }
  if (!input.categoryId || input.categoryId.trim().length === 0) {
    errors.push("Category is required");
  }
  if (input.amount <= 0) {
    errors.push("Budget amount must be greater than 0");
  }
  if (input.amount > 1000000) {
    errors.push("Budget amount must be less than 1,000,000");
  }

  return errors;
}

/**
 * Calculate the effective monthly amount from a budget with a given period.
 * Returns the monthly equivalent.
 */
export function getMonthlyEquivalent(amount: number, period: string): number {
  switch (period) {
    case "weekly":
      return Math.round((amount * 52 / 12) * 100) / 100;
    case "yearly":
      return Math.round((amount / 12) * 100) / 100;
    case "monthly":
    default:
      return amount;
  }
}
