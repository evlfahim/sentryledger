/**
 * Unit tests for the safe-to-spend calculation engine.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateSafeToSpend,
  calculateDailySafeAmount,
  validateSavingsGoal,
  getSavingsGoalProgress,
  formatCurrency,
  formatPercent,
  getDaysRemainingInMonth,
  getDaysElapsedInMonth,
  getMonthStart,
  getMonthEnd,
} from "@/lib/safe-to-spend/engine";
import type { TransactionRow, SavingsGoalRow } from "@/lib/import/db";

// ─── Test fixtures ───────────────────────────────────────────────────────────

const now = new Date();
const monthStart = getMonthStart(now);
const monthEnd = getMonthEnd(now);

function makeTransaction(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: "tx-1",
    account_id: "acc-1",
    date: now.toISOString(),
    description: "Test Transaction",
    amount: -50,
    category: "Groceries",
    rule_id: null,
    is_bill: 0,
    is_duplicate: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

function makeSavingsGoal(overrides: Partial<SavingsGoalRow> = {}): SavingsGoalRow {
  return {
    id: "goal-1",
    name: "Emergency Fund",
    target_amount: 10000,
    current_amount: 2000,
    monthly_contribution: 500,
    deadline: new Date(now.getFullYear(), now.getMonth() + 6, 1).toISOString(),
    is_active: 1,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

// ─── Date helpers tests ──────────────────────────────────────────────────────

describe("date helpers", () => {
  it("should return the first day of the month", () => {
    const result = getMonthStart(new Date("2024-03-15"));
    expect(result).toEqual(new Date(2024, 2, 1));
  });

  it("should return the last day of the month", () => {
    const result = getMonthEnd(new Date("2024-03-15"));
    expect(result).toEqual(new Date(2024, 2, 31, 23, 59, 59, 999));
  });

  it("should return the last day of February in a leap year", () => {
    const result = getMonthEnd(new Date("2024-02-15"));
    expect(result).toEqual(new Date(2024, 1, 29, 23, 59, 59, 999));
  });

  it("should return the last day of February in a non-leap year", () => {
    const result = getMonthEnd(new Date("2023-02-15"));
    expect(result).toEqual(new Date(2023, 1, 28, 23, 59, 59, 999));
  });

  it("should return positive days remaining", () => {
    const days = getDaysRemainingInMonth();
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(31);
  });

  it("should return positive days elapsed", () => {
    const days = getDaysElapsedInMonth();
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(31);
  });
});

// ─── calculateSafeToSpend tests ──────────────────────────────────────────────

describe("calculateSafeToSpend", () => {
  it("should return zero safe-to-spend with no data", () => {
    const result = calculateSafeToSpend([], [], []);

    expect(result.totalIncome).toBe(0);
    expect(result.totalBills).toBe(0);
    expect(result.totalBudgetedSpending).toBe(0);
    expect(result.totalSavingsGoals).toBe(0);
    expect(result.safeToSpend).toBe(0);
    expect(result.safeToSpendPercent).toBe(0);
    expect(result.isSafe).toBe(true);
    expect(result.deductions).toHaveLength(0);
  });

  it("should calculate safe-to-spend with income only", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
    ];

    const result = calculateSafeToSpend(transactions, [], []);

    expect(result.totalIncome).toBe(3000);
    expect(result.totalBills).toBe(0);
    expect(result.totalBudgetedSpending).toBe(0);
    expect(result.safeToSpend).toBe(3000);
    expect(result.safeToSpendPercent).toBe(100);
    expect(result.isSafe).toBe(true);
  });

  it("should subtract bills from safe-to-spend", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
      makeTransaction({ amount: -1200, description: "Rent", is_bill: 1 }),
      makeTransaction({ amount: -150, description: "Electric", is_bill: 1 }),
    ];

    const result = calculateSafeToSpend(transactions, [], []);

    expect(result.totalIncome).toBe(3000);
    expect(result.totalBills).toBe(1350);
    expect(result.safeToSpend).toBe(1650);
    expect(result.isSafe).toBe(true);
  });

  it("should subtract budgeted spending from safe-to-spend", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
      makeTransaction({ amount: -200, description: "Groceries" }),
      makeTransaction({ amount: -50, description: "Gas" }),
    ];

    const result = calculateSafeToSpend(transactions, [], []);

    expect(result.totalIncome).toBe(3000);
    expect(result.totalBudgetedSpending).toBe(250);
    expect(result.safeToSpend).toBe(2750);
  });

  it("should subtract savings goals from safe-to-spend", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
    ];
    const goals: SavingsGoalRow[] = [
      makeSavingsGoal({ monthly_contribution: 500 }),
    ];

    const result = calculateSafeToSpend(transactions, [], goals);

    expect(result.totalIncome).toBe(3000);
    expect(result.totalSavingsGoals).toBe(500);
    expect(result.safeToSpend).toBe(2500);
  });

  it("should calculate safe-to-spend with all deductions", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 5000, description: "Salary" }),
      makeTransaction({ amount: -1500, description: "Rent", is_bill: 1 }),
      makeTransaction({ amount: -200, description: "Groceries" }),
      makeTransaction({ amount: -100, description: "Gas" }),
    ];
    const goals: SavingsGoalRow[] = [
      makeSavingsGoal({ monthly_contribution: 300 }),
    ];

    const result = calculateSafeToSpend(transactions, [], goals);

    expect(result.totalIncome).toBe(5000);
    expect(result.totalBills).toBe(1500);
    expect(result.totalBudgetedSpending).toBe(300);
    expect(result.totalSavingsGoals).toBe(300);
    expect(result.safeToSpend).toBe(2900);
    expect(result.isSafe).toBe(true);
  });

  it("should detect when safe-to-spend is negative", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 1000, description: "Salary" }),
      makeTransaction({ amount: -800, description: "Rent", is_bill: 1 }),
      makeTransaction({ amount: -400, description: "Shopping" }),
    ];

    const result = calculateSafeToSpend(transactions, [], []);

    expect(result.safeToSpend).toBe(-200);
    expect(result.isSafe).toBe(false);
    expect(result.warning).toBeDefined();
  });

  it("should include deductions in the breakdown", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
      makeTransaction({ amount: -500, description: "Rent", is_bill: 1 }),
      makeTransaction({ amount: -200, description: "Groceries" }),
    ];

    const result = calculateSafeToSpend(transactions, [], []);

    expect(result.deductions).toHaveLength(2);
    expect(result.deductions[0].label).toBe("Bills");
    expect(result.deductions[0].amount).toBe(500);
    expect(result.deductions[1].label).toBe("Budgeted Spending");
    expect(result.deductions[1].amount).toBe(200);
  });

  it("should filter transactions by month", () => {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary", date: now.toISOString() }),
      makeTransaction({ amount: 2000, description: "Last Month Salary", date: lastMonth.toISOString() }),
      makeTransaction({ amount: -500, description: "Rent", is_bill: 1, date: now.toISOString() }),
    ];

    const result = calculateSafeToSpend(transactions, [], []);

    expect(result.totalIncome).toBe(3000);
    expect(result.totalBills).toBe(500);
  });

  it("should ignore positive amounts for bill calculation", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
      makeTransaction({ amount: 100, description: "Refund", is_bill: 1 }),
    ];

    const result = calculateSafeToSpend(transactions, [], []);

    expect(result.totalBills).toBe(0);
  });

  it("should ignore positive amounts for budgeted spending", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
      makeTransaction({ amount: 100, description: "Refund" }),
    ];

    const result = calculateSafeToSpend(transactions, [], []);

    expect(result.totalBudgetedSpending).toBe(0);
  });

  it("should handle savings goals without monthly contribution", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
    ];
    const goals: SavingsGoalRow[] = [
      makeSavingsGoal({
        monthly_contribution: 0,
        target_amount: 10000,
        current_amount: 2000,
        deadline: new Date(now.getFullYear(), now.getMonth() + 4, 1).toISOString(),
      }),
    ];

    const result = calculateSafeToSpend(transactions, [], goals);

    // 8000 remaining / ~4 months = ~2000/month
    expect(result.totalSavingsGoals).toBeGreaterThan(0);
    expect(result.safeToSpend).toBeLessThan(3000);
  });

  it("should exclude inactive savings goals", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
    ];
    const goals: SavingsGoalRow[] = [
      makeSavingsGoal({ is_active: 0, monthly_contribution: 500 }),
    ];

    const result = calculateSafeToSpend(transactions, [], goals);

    expect(result.totalSavingsGoals).toBe(0);
  });

  it("should round values to 2 decimal places", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3333.333, description: "Salary" }),
      makeTransaction({ amount: -111.111, description: "Rent", is_bill: 1 }),
    ];

    const result = calculateSafeToSpend(transactions, [], []);

    expect(result.totalIncome).toBe(3333.33);
    expect(result.totalBills).toBe(111.11);
    expect(result.safeToSpend).toBe(3222.22);
  });
});

// ─── calculateDailySafeAmount tests ──────────────────────────────────────────

describe("calculateDailySafeAmount", () => {
  it("should calculate daily safe amount", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
    ];

    const result = calculateDailySafeAmount(transactions, [], []);

    expect(result.totalSafe).toBe(3000);
    expect(result.daysRemaining).toBeGreaterThan(0);
    expect(result.dailyAmount).toBeCloseTo(3000 / result.daysRemaining, 0);
  });

  it("should return zero daily amount when no income", () => {
    const result = calculateDailySafeAmount([], [], []);

    expect(result.totalSafe).toBe(0);
    expect(result.dailyAmount).toBe(0);
  });

  it("should account for deductions in daily amount", () => {
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: 3000, description: "Salary" }),
      makeTransaction({ amount: -1000, description: "Rent", is_bill: 1 }),
    ];

    const result = calculateDailySafeAmount(transactions, [], []);

    expect(result.totalSafe).toBe(2000);
    expect(result.dailyAmount).toBeCloseTo(2000 / result.daysRemaining, 0);
  });
});

// ─── validateSavingsGoal tests ───────────────────────────────────────────────

describe("validateSavingsGoal", () => {
  it("should return no errors for valid input", () => {
    const result = validateSavingsGoal({
      name: "Emergency Fund",
      targetAmount: 10000,
      currentAmount: 2000,
      monthlyContribution: 500,
      deadline: new Date("2025-12-31").toISOString(),
      isActive: true,
    });
    expect(result).toEqual([]);
  });

  it("should error on empty name", () => {
    const result = validateSavingsGoal({
      name: "",
      targetAmount: 10000,
      currentAmount: 0,
      monthlyContribution: 0,
      deadline: null as string | null,
      isActive: true,
    });
    expect(result).toContain("Goal name is required");
  });

  it("should error on zero target amount", () => {
    const result = validateSavingsGoal({
      name: "Fund",
      targetAmount: 0,
      currentAmount: 0,
      monthlyContribution: 0,
      deadline: null as string | null,
      isActive: true,
    });
    expect(result).toContain("Target amount must be greater than 0");
  });

  it("should error on negative target amount", () => {
    const result = validateSavingsGoal({
      name: "Fund",
      targetAmount: -100,
      currentAmount: 0,
      monthlyContribution: 0,
      deadline: null as string | null,
      isActive: true,
    });
    expect(result).toContain("Target amount must be greater than 0");
  });

  it("should error on current amount exceeding target", () => {
    const result = validateSavingsGoal({
      name: "Fund",
      targetAmount: 1000,
      currentAmount: 2000,
      monthlyContribution: 0,
      deadline: null as string | null,
      isActive: true,
    });
    expect(result).toContain("Current amount cannot exceed target amount");
  });

  it("should error on negative current amount", () => {
    const result = validateSavingsGoal({
      name: "Fund",
      targetAmount: 1000,
      currentAmount: -100,
      monthlyContribution: 0,
      deadline: null as string | null,
      isActive: true,
    });
    expect(result).toContain("Current amount cannot be negative");
  });

  it("should error on negative monthly contribution", () => {
    const result = validateSavingsGoal({
      name: "Fund",
      targetAmount: 1000,
      currentAmount: 0,
      monthlyContribution: -50,
      deadline: null as string | null,
      isActive: true,
    });
    expect(result).toContain("Monthly contribution cannot be negative");
  });

  it("should error on invalid deadline", () => {
    const result = validateSavingsGoal({
      name: "Fund",
      targetAmount: 1000,
      currentAmount: 0,
      monthlyContribution: 0,
      deadline: "not-a-date",
      isActive: true,
    });
    expect(result).toContain("Invalid deadline date");
  });

  it("should allow null deadline", () => {
    const result = validateSavingsGoal({
      name: "Fund",
      targetAmount: 1000,
      currentAmount: 0,
      monthlyContribution: 0,
      deadline: null as string | null,
      isActive: true,
    });
    expect(result).toEqual([]);
  });

  it("should error on target amount exceeding maximum", () => {
    const result = validateSavingsGoal({
      name: "Fund",
      targetAmount: 20000000,
      currentAmount: 0,
      monthlyContribution: 0,
      deadline: null as string | null,
      isActive: true,
    });
    expect(result).toContain("Target amount must be less than 10,000,000");
  });
});

// ─── getSavingsGoalProgress tests ────────────────────────────────────────────

describe("getSavingsGoalProgress", () => {
  it("should calculate progress correctly", () => {
    const goal = makeSavingsGoal({
      target_amount: 10000,
      current_amount: 2000,
    });

    const result = getSavingsGoalProgress(goal);

    expect(result.name).toBe("Emergency Fund");
    expect(result.targetAmount).toBe(10000);
    expect(result.currentAmount).toBe(2000);
    expect(result.remaining).toBe(8000);
    expect(result.percentage).toBeCloseTo(20, 0);
    expect(result.isComplete).toBe(false);
  });

  it("should detect complete goals", () => {
    const goal = makeSavingsGoal({
      target_amount: 5000,
      current_amount: 5000,
    });

    const result = getSavingsGoalProgress(goal);

    expect(result.isComplete).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.percentage).toBe(100);
  });

  it("should handle zero target amount", () => {
    const goal = makeSavingsGoal({
      target_amount: 0,
      current_amount: 0,
    });

    const result = getSavingsGoalProgress(goal);

    expect(result.percentage).toBe(0);
  });

  it("should include deadline information", () => {
    const goal = makeSavingsGoal({
      deadline: new Date(now.getFullYear(), now.getMonth() + 3, 15).toISOString(),
    });

    const result = getSavingsGoalProgress(goal);

    expect(result.deadline).toBeDefined();
    expect(result.daysUntilDeadline).toBeGreaterThan(0);
  });

  it("should handle goals without deadline", () => {
    const goal = makeSavingsGoal({
      deadline: null,
    });

    const result = getSavingsGoalProgress(goal);

    expect(result.deadline).toBeUndefined();
    expect(result.daysUntilDeadline).toBeUndefined();
  });
});

// ─── formatCurrency tests ────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("should format positive amounts", () => {
    expect(formatCurrency(100)).toBe("$100.00");
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("should format negative amounts", () => {
    expect(formatCurrency(-100)).toBe("-$100.00");
  });

  it("should format zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

// ─── formatPercent tests ─────────────────────────────────────────────────────

describe("formatPercent", () => {
  it("should format percentages with one decimal", () => {
    expect(formatPercent(50)).toBe("50.0%");
    expect(formatPercent(33.333)).toBe("33.3%");
    expect(formatPercent(100)).toBe("100.0%");
  });
});
