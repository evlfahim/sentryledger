/**
 * Safe-to-spend calculation engine.
 *
 * Computes how much money is "safe" to spend right now by subtracting
 * recurring bills, upcoming savings goals, and budgeted spending from
 * the user's available income.
 *
 * Formula:
 *   safeToSpend = availableIncome - totalBills - totalBudgetedSpending - savingsGoals
 *
 * Where:
 *   - availableIncome: sum of all positive transactions in the current month
 *   - totalBills: sum of all transactions marked as bills in the current month
 *   - totalBudgetedSpending: sum of all spent amounts for budgeted categories
 *   - savingsGoals: sum of active savings goals for the current period
 */

import type { TransactionRow, SavingsGoalRow } from "@/lib/import/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SafeToSpendResult {
  /** Total income for the period (positive transactions) */
  totalIncome: number;
  /** Total bill payments for the period */
  totalBills: number;
  /** Total spent on budgeted categories for the period */
  totalBudgetedSpending: number;
  /** Total savings goal contributions for the period */
  totalSavingsGoals: number;
  /** Remaining amount safe to spend */
  safeToSpend: number;
  /** Percentage of income that is safe to spend */
  safeToSpendPercent: number;
  /** Breakdown of deductions */
  deductions: {
    label: string;
    amount: number;
    percentage: number;
  }[];
  /** Whether the user is in a safe zone */
  isSafe: boolean;
  /** Warning message if not safe */
  warning?: string;
}

export interface SavingsGoalInput {
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null; // ISO date string or null
  monthlyContribution: number;
  isActive: boolean;
}

export interface UpdateSavingsGoalInput {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: string | null;
  monthlyContribution?: number;
  isActive?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the first day of the current month.
 */
export function getMonthStart(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the last day of the current month.
 */
export function getMonthEnd(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Check if a date falls within a range.
 */
function isInDateRange(txDate: Date, start: Date, end: Date): boolean {
  return txDate >= start && txDate <= end;
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

/**
 * Get the number of days remaining in the current month.
 */
export function getDaysRemainingInMonth(date: Date = new Date()): number {
  const end = getMonthEnd(date);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get the number of days elapsed in the current month.
 */
export function getDaysElapsedInMonth(date: Date = new Date()): number {
  const start = getMonthStart(date);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

/**
 * Calculate total income from positive transactions within a date range.
 */
function calculateTotalIncome(
  transactions: TransactionRow[],
  monthStart: Date,
  monthEnd: Date
): number {
  return transactions
    .filter((tx) => {
      const txDate = new Date(tx.date);
      return tx.amount > 0 && isInDateRange(txDate, monthStart, monthEnd);
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Calculate total bill payments from transactions marked as bills within a date range.
 * Only counts negative (debit) transactions — bill refunds are not counted.
 */
function calculateTotalBills(
  transactions: TransactionRow[],
  monthStart: Date,
  monthEnd: Date
): number {
  return transactions
    .filter((tx) => {
      const txDate = new Date(tx.date);
      return tx.is_bill === 1 && tx.amount < 0 && isInDateRange(txDate, monthStart, monthEnd);
    })
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

/**
 * Calculate total spending on budgeted categories within a date range.
 * Only counts negative (debit) transactions, excluding bills (which are tracked separately).
 */
function calculateBudgetedSpending(
  transactions: TransactionRow[],
  monthStart: Date,
  monthEnd: Date
): number {
  return transactions
    .filter((tx) => {
      const txDate = new Date(tx.date);
      return tx.amount < 0 && !tx.is_bill && isInDateRange(txDate, monthStart, monthEnd);
    })
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

/**
 * Calculate the monthly contribution for savings goals.
 * For goals with a deadline, prorate the monthly contribution based on
 * how many months remain until the deadline.
 */
function calculateSavingsGoalMonthlyContribution(
  goals: SavingsGoalRow[]
): number {
  let totalMonthly = 0;

  for (const goal of goals) {
    if (!goal.is_active) continue;

    // If the goal has a monthly contribution set, use it
    if (goal.monthly_contribution > 0) {
      totalMonthly += goal.monthly_contribution;
      continue;
    }

    // Otherwise, calculate based on remaining amount and time
    if (goal.deadline && goal.target_amount > 0) {
      const deadline = new Date(goal.deadline);
      const now = new Date();
      const monthsRemaining = Math.max(
        1,
        Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      );
      const remaining = goal.target_amount - goal.current_amount;
      if (remaining > 0) {
        totalMonthly += Math.round((remaining / monthsRemaining) * 100) / 100;
      }
    }
  }

  return Math.round(totalMonthly * 100) / 100;
}

/**
 * Calculate the safe-to-spend amount.
 *
 * This is the amount of money available for discretionary spending
 * after accounting for income, bills, budgeted spending, and savings goals.
 *
 * @param transactions - All transactions (positive = income, negative = expense)
 * @param bills - Transactions marked as bills (subset of transactions)
 * @param budgets - Budget definitions (used to calculate budgeted spending)
 * @param savingsGoals - Active savings goals
 * @param period - "current" (this month) or "custom" with custom dates
 * @param customStart - Custom start date (required if period is "custom")
 * @param customEnd - Custom end date (required if period is "custom")
 */
export function calculateSafeToSpend(
  transactions: TransactionRow[],
  budgets: { amount: number; period: string; category_id: string }[],
  savingsGoals: SavingsGoalRow[],
  period: "current" | "custom" = "current",
  customStart?: Date,
  customEnd?: Date
): SafeToSpendResult {
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

  // Calculate components
  const totalIncome = Math.round(calculateTotalIncome(transactions, monthStart, monthEnd) * 100) / 100;
  const totalBills = Math.round(calculateTotalBills(transactions, monthStart, monthEnd) * 100) / 100;
  const totalBudgetedSpending = Math.round(
    calculateBudgetedSpending(transactions, monthStart, monthEnd) * 100
  ) / 100;
  const totalSavingsGoals = calculateSavingsGoalMonthlyContribution(savingsGoals);

  // Safe to spend = income - bills - budgeted spending - savings goals
  const safeToSpend = Math.round(
    (totalIncome - totalBills - totalBudgetedSpending - totalSavingsGoals) * 100
  ) / 100;

  // Percentage of income that is safe to spend
  const safeToSpendPercent = totalIncome > 0
    ? Math.round((safeToSpend / totalIncome) * 1000) / 10
    : 0;

  // Deductions breakdown
  const deductions = [
    {
      label: "Bills",
      amount: totalBills,
      percentage: totalIncome > 0 ? Math.round((totalBills / totalIncome) * 1000) / 10 : 0,
    },
    {
      label: "Budgeted Spending",
      amount: totalBudgetedSpending,
      percentage: totalIncome > 0 ? Math.round((totalBudgetedSpending / totalIncome) * 1000) / 10 : 0,
    },
    {
      label: "Savings Goals",
      amount: totalSavingsGoals,
      percentage: totalIncome > 0 ? Math.round((totalSavingsGoals / totalIncome) * 1000) / 10 : 0,
    },
  ].filter((d) => d.amount > 0);

  // Determine safety status
  const isSafe = safeToSpend >= 0;
  const daysRemaining = getDaysRemainingInMonth();
  const dailySafeAmount = daysRemaining > 0 ? Math.round((safeToSpend / daysRemaining) * 100) / 100 : 0;

  let warning: string | undefined;
  if (!isSafe) {
    warning = `You've exceeded your safe-to-spend amount by ${formatCurrency(Math.abs(safeToSpend))}. `
      + `With ${daysRemaining} days remaining, that's ${formatCurrency(Math.abs(dailySafeAmount))} per day over budget.`;
  } else if (safeToSpendPercent < 10) {
    warning = `You're down to ${formatPercent(Math.abs(safeToSpendPercent))} of your income. `
      + `Consider reducing discretionary spending.`;
  }

  return {
    totalIncome,
    totalBills,
    totalBudgetedSpending,
    totalSavingsGoals,
    safeToSpend,
    safeToSpendPercent,
    deductions,
    isSafe,
    warning,
  };
}

/**
 * Calculate safe-to-spend on a daily basis.
 * Returns the average daily amount available for spending.
 */
export function calculateDailySafeAmount(
  transactions: TransactionRow[],
  budgets: { amount: number; period: string; category_id: string }[],
  savingsGoals: SavingsGoalRow[],
  period: "current" | "custom" = "current",
  customStart?: Date,
  customEnd?: Date
): { dailyAmount: number; daysRemaining: number; totalSafe: number } {
  const result = calculateSafeToSpend(
    transactions, budgets, savingsGoals, period, customStart, customEnd
  );
  const daysRemaining = getDaysRemainingInMonth();
  const dailyAmount = daysRemaining > 0
    ? Math.round((result.safeToSpend / daysRemaining) * 100) / 100
    : 0;

  return {
    dailyAmount,
    daysRemaining,
    totalSafe: result.safeToSpend,
  };
}

/**
 * Validate a savings goal input.
 */
export function validateSavingsGoal(
  input: SavingsGoalInput
): string[] {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push("Goal name is required");
  }
  if (input.targetAmount <= 0) {
    errors.push("Target amount must be greater than 0");
  }
  if (input.targetAmount > 10000000) {
    errors.push("Target amount must be less than 10,000,000");
  }
  if (input.currentAmount < 0) {
    errors.push("Current amount cannot be negative");
  }
  if (input.currentAmount > input.targetAmount) {
    errors.push("Current amount cannot exceed target amount");
  }
  if (input.monthlyContribution < 0) {
    errors.push("Monthly contribution cannot be negative");
  }
  if (input.deadline) {
    const deadline = new Date(input.deadline);
    if (isNaN(deadline.getTime())) {
      errors.push("Invalid deadline date");
    }
  }

  return errors;
}

/**
 * Get savings goal progress information.
 */
export function getSavingsGoalProgress(
  goal: SavingsGoalRow
): {
  name: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  percentage: number;
  monthlyContribution: number;
  deadline?: string;
  daysUntilDeadline?: number;
  isComplete: boolean;
} {
  const remaining = goal.target_amount - goal.current_amount;
  const percentage = goal.target_amount > 0
    ? Math.round((goal.current_amount / goal.target_amount) * 1000) / 10
    : 0;

  let daysUntilDeadline: number | undefined;
  if (goal.deadline) {
    const deadline = new Date(goal.deadline);
    const now = new Date();
    daysUntilDeadline = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return {
    name: goal.name,
    targetAmount: goal.target_amount,
    currentAmount: goal.current_amount,
    remaining: Math.round(remaining * 100) / 100,
    percentage,
    monthlyContribution: goal.monthly_contribution,
    deadline: goal.deadline ?? undefined,
    daysUntilDeadline,
    isComplete: remaining <= 0,
  };
}
