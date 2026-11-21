/**
 * Unit tests for the budget calculation engine.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateOverallBudget,
  calculateBudgetProgress,
  validateBudget,
  getMonthlyEquivalent,
  formatCurrency,
  formatPercent,
} from "@/lib/budgets/engine";
import type { BudgetRow, TransactionRow } from "@/lib/import/db";

// ─── Test fixtures ───────────────────────────────────────────────────────────

// Use the current month for all test transactions so date filtering works
const now = new Date();
const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

function makeBudget(overrides: Partial<BudgetRow> = {}): BudgetRow {
  return {
    id: "budget-1",
    name: "Groceries",
    category_id: "Groceries",
    amount: 500,
    period: "monthly",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("validateBudget", () => {
  it("should return no errors for valid input", () => {
    const result = validateBudget({
      name: "Groceries",
      categoryId: "Groceries",
      amount: 500,
      period: "monthly",
    });
    expect(result).toEqual([]);
  });

  it("should error on empty name", () => {
    const result = validateBudget({
      name: "",
      categoryId: "Groceries",
      amount: 500,
      period: "monthly",
    });
    expect(result).toContain("Budget name is required");
  });

  it("should error on empty categoryId", () => {
    const result = validateBudget({
      name: "Groceries",
      categoryId: "",
      amount: 500,
      period: "monthly",
    });
    expect(result).toContain("Category is required");
  });

  it("should error on zero amount", () => {
    const result = validateBudget({
      name: "Groceries",
      categoryId: "Groceries",
      amount: 0,
      period: "monthly",
    });
    expect(result).toContain("Budget amount must be greater than 0");
  });

  it("should error on negative amount", () => {
    const result = validateBudget({
      name: "Groceries",
      categoryId: "Groceries",
      amount: -100,
      period: "monthly",
    });
    expect(result).toContain("Budget amount must be greater than 0");
  });

  it("should error on amount exceeding maximum", () => {
    const result = validateBudget({
      name: "Groceries",
      categoryId: "Groceries",
      amount: 2000000,
      period: "monthly",
    });
    expect(result).toContain("Budget amount must be less than 1,000,000");
  });
});

describe("getMonthlyEquivalent", () => {
  it("should return the same amount for monthly", () => {
    expect(getMonthlyEquivalent(500, "monthly")).toBe(500);
  });

  it("should convert weekly to monthly", () => {
    // 50/week * 52 weeks / 12 months = ~216.67
    const result = getMonthlyEquivalent(50, "weekly");
    expect(result).toBeCloseTo(216.67, 1);
  });

  it("should convert yearly to monthly", () => {
    // 6000/year / 12 months = 500
    const result = getMonthlyEquivalent(6000, "yearly");
    expect(result).toBe(500);
  });
});

describe("calculateBudgetProgress", () => {
  it("should return zero spending when no transactions match", () => {
    const budget = makeBudget({ category_id: "Groceries", amount: 500 });
    const transactions: TransactionRow[] = [];

    const result = calculateBudgetProgress(budget, transactions);

    expect(result.categorySummary.spent).toBe(0);
    expect(result.categorySummary.remaining).toBe(500);
    expect(result.categorySummary.percentage).toBe(0);
    expect(result.alertLevel).toBe("ok");
  });

  it("should calculate spending correctly", () => {
    const budget = makeBudget({ category_id: "Groceries", amount: 500 });
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: -50, category: "Groceries" }),
      makeTransaction({ amount: -100, category: "Groceries" }),
      makeTransaction({ amount: -25, category: "Groceries" }),
    ];

    const result = calculateBudgetProgress(budget, transactions);

    expect(result.categorySummary.spent).toBe(175);
    expect(result.categorySummary.remaining).toBe(325);
    expect(result.categorySummary.percentage).toBeCloseTo(35, 0);
    expect(result.alertLevel).toBe("ok");
  });

  it("should detect overspending", () => {
    const budget = makeBudget({ category_id: "Groceries", amount: 100 });
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: -60, category: "Groceries" }),
      makeTransaction({ amount: -50, category: "Groceries" }),
    ];

    const result = calculateBudgetProgress(budget, transactions);

    expect(result.categorySummary.spent).toBe(110);
    expect(result.categorySummary.remaining).toBe(-10);
    expect(result.categorySummary.isOver).toBe(true);
    expect(result.alertLevel).toBe("over");
  });

  it("should warn when approaching budget limit (80%+)", () => {
    const budget = makeBudget({ category_id: "Groceries", amount: 100 });
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: -85, category: "Groceries" }),
    ];

    const result = calculateBudgetProgress(budget, transactions);

    expect(result.alertLevel).toBe("warning");
    expect(result.categorySummary.percentage).toBeCloseTo(85, 0);
  });

  it("should ignore credits (positive amounts)", () => {
    const budget = makeBudget({ category_id: "Groceries", amount: 500 });
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: -50, category: "Groceries" }),
      makeTransaction({ amount: 100, category: "Groceries" }), // credit, should be ignored
    ];

    const result = calculateBudgetProgress(budget, transactions);

    expect(result.categorySummary.spent).toBe(50);
  });

  it("should ignore transactions from other categories", () => {
    const budget = makeBudget({ category_id: "Groceries", amount: 500 });
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: -50, category: "Groceries" }),
      makeTransaction({ amount: -200, category: "Restaurants" }),
    ];

    const result = calculateBudgetProgress(budget, transactions);

    expect(result.categorySummary.spent).toBe(50);
  });

  it("should count transactions correctly", () => {
    const budget = makeBudget({ category_id: "Groceries", amount: 500 });
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: -50, category: "Groceries" }),
      makeTransaction({ amount: -100, category: "Groceries" }),
      makeTransaction({ amount: -25, category: "Groceries" }),
    ];

    const result = calculateBudgetProgress(budget, transactions);

    expect(result.categorySummary.transactionCount).toBe(3);
  });

  it("should use custom date range when provided", () => {
    const budget = makeBudget({ category_id: "Groceries", amount: 500 });
    const transactions: TransactionRow[] = [
      makeTransaction({ amount: -100, category: "Groceries" }),
    ];

    // Use a custom date range that includes the current date
    const customStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const customEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const result = calculateBudgetProgress(
      budget,
      transactions,
      "custom",
      customStart,
      customEnd
    );

    expect(result.categorySummary.spent).toBe(100);
  });
});

describe("calculateOverallBudget", () => {
  it("should return empty summary with no budgets", () => {
    const budgets: BudgetRow[] = [];
    const transactions: TransactionRow[] = [];

    const result = calculateOverallBudget(budgets, transactions);

    expect(result.totalBudgeted).toBe(0);
    expect(result.totalSpent).toBe(0);
    expect(result.totalRemaining).toBe(0);
    expect(result.budgets).toEqual([]);
    expect(result.alerts).toEqual([]);
  });

  it("should aggregate spending across multiple budgets", () => {
    const budgets: BudgetRow[] = [
      makeBudget({ id: "b1", category_id: "Groceries", amount: 500 }),
      makeBudget({ id: "b2", category_id: "Restaurants", amount: 200 }),
    ];

    const transactions: TransactionRow[] = [
      makeTransaction({ id: "t1", amount: -100, category: "Groceries" }),
      makeTransaction({ id: "t2", amount: -50, category: "Groceries" }),
      makeTransaction({ id: "t3", amount: -80, category: "Restaurants" }),
    ];

    const result = calculateOverallBudget(budgets, transactions);

    expect(result.totalBudgeted).toBe(700);
    expect(result.totalSpent).toBe(230);
    expect(result.totalRemaining).toBe(470);
    expect(result.budgets).toHaveLength(2);
  });

  it("should generate alerts for over-budget categories", () => {
    const budgets: BudgetRow[] = [
      makeBudget({ id: "b1", category_id: "Groceries", amount: 100 }),
    ];

    const transactions: TransactionRow[] = [
      makeTransaction({ id: "t1", amount: -60, category: "Groceries" }),
      makeTransaction({ id: "t2", amount: -50, category: "Groceries" }),
    ];

    const result = calculateOverallBudget(budgets, transactions);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].level).toBe("over");
    expect(result.alerts[0].overAmount).toBe(10);
  });

  it("should generate warnings for near-budget categories", () => {
    const budgets: BudgetRow[] = [
      makeBudget({ id: "b1", category_id: "Groceries", amount: 100 }),
    ];

    const transactions: TransactionRow[] = [
      makeTransaction({ id: "t1", amount: -85, category: "Groceries" }),
    ];

    const result = calculateOverallBudget(budgets, transactions);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].level).toBe("warning");
  });

  it("should include category breakdown for all categories with spending", () => {
    const budgets: BudgetRow[] = [
      makeBudget({ id: "b1", category_id: "Groceries", amount: 500 }),
    ];

    const transactions: TransactionRow[] = [
      makeTransaction({ id: "t1", amount: -100, category: "Groceries" }),
      makeTransaction({ id: "t2", amount: -50, category: "Restaurants" }),
      makeTransaction({ id: "t3", amount: -30, category: "Gas & Fuel" }),
    ];

    const result = calculateOverallBudget(budgets, transactions);

    expect(result.categoryBreakdown).toHaveLength(3);
    expect(result.categoryBreakdown[0].category).toBe("Groceries");
    expect(result.categoryBreakdown[0].spent).toBe(100);
    expect(result.categoryBreakdown[1].category).toBe("Restaurants");
    expect(result.categoryBreakdown[1].spent).toBe(50);
    expect(result.categoryBreakdown[2].category).toBe("Gas & Fuel");
    expect(result.categoryBreakdown[2].spent).toBe(30);
  });

  it("should sort category breakdown by spending descending", () => {
    const budgets: BudgetRow[] = [];
    const transactions: TransactionRow[] = [
      makeTransaction({ id: "t1", amount: -10, category: "Small" }),
      makeTransaction({ id: "t2", amount: -100, category: "Large" }),
      makeTransaction({ id: "t3", amount: -50, category: "Medium" }),
    ];

    const result = calculateOverallBudget(budgets, transactions);

    expect(result.categoryBreakdown[0].category).toBe("Large");
    expect(result.categoryBreakdown[1].category).toBe("Medium");
    expect(result.categoryBreakdown[2].category).toBe("Small");
  });

  it("should handle budgets with no matching transactions", () => {
    const budgets: BudgetRow[] = [
      makeBudget({ id: "b1", category_id: "Groceries", amount: 500 }),
    ];
    const transactions: TransactionRow[] = [
      makeTransaction({ id: "t1", amount: -50, category: "Restaurants" }),
    ];

    const result = calculateOverallBudget(budgets, transactions);

    expect(result.budgets[0].categorySummary.spent).toBe(0);
    expect(result.budgets[0].categorySummary.remaining).toBe(500);
    expect(result.budgets[0].alertLevel).toBe("ok");
  });

  it("should handle multiple budgets with mixed alerts", () => {
    const budgets: BudgetRow[] = [
      makeBudget({ id: "b1", category_id: "Groceries", amount: 100 }),
      makeBudget({ id: "b2", category_id: "Restaurants", amount: 500 }),
      makeBudget({ id: "b3", category_id: "Gas & Fuel", amount: 50 }),
    ];

    const transactions: TransactionRow[] = [
      makeTransaction({ id: "t1", amount: -120, category: "Groceries" }), // over
      makeTransaction({ id: "t2", amount: -450, category: "Restaurants" }), // warning (90%)
      makeTransaction({ id: "t3", amount: -10, category: "Gas & Fuel" }), // ok
    ];

    const result = calculateOverallBudget(budgets, transactions);

    expect(result.alerts).toHaveLength(2);
    expect(result.alerts.some((a) => a.level === "over")).toBe(true);
    expect(result.alerts.some((a) => a.level === "warning")).toBe(true);
  });
});

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

describe("formatPercent", () => {
  it("should format percentages with one decimal", () => {
    expect(formatPercent(50)).toBe("50.0%");
    expect(formatPercent(33.333)).toBe("33.3%");
    expect(formatPercent(100)).toBe("100.0%");
  });
});
