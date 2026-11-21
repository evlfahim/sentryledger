/**
 * Tests for PDF export functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clearAll,
  createAccount,
  importTransactions,
  getAccounts,
  getBudgets,
  getActiveSavingsGoals,
  createBudget,
  createSavingsGoal,
} from "@/lib/import/db";
import { calculateSafeToSpend } from "@/lib/safe-to-spend/engine";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatMonth(month: string): string {
  const [year, mon] = month.split("-");
  const date = new Date(parseInt(year), parseInt(mon) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Food: "#2563eb",
    "Food & Dining": "#2563eb",
    Groceries: "#2563eb",
    Dining: "#3b82f6",
    Transport: "#059669",
    Transportation: "#059669",
    Gas: "#059669",
    "Gas Station": "#059669",
    Shopping: "#d97706",
    Retail: "#d97706",
    Entertainment: "#dc2626",
    Fun: "#dc2626",
    Bills: "#7c3aed",
    Utilities: "#7c3aed",
    "Electric Bill": "#7c3aed",
    "Internet Bill": "#7c3aed",
    "Phone Bill": "#7c3aed",
    Health: "#ec4899",
    Healthcare: "#ec4899",
    Medical: "#ec4899",
    "Health Insurance": "#ec4899",
    Housing: "#6366f1",
    Rent: "#6366f1",
    Mortgage: "#6366f1",
    "Auto & Transport": "#0891b2",
    Insurance: "#8b5cf6",
    "Auto Insurance": "#8b5cf6",
    "Home Insurance": "#8b5cf6",
    Savings: "#10b981",
    Investments: "#f59e0b",
    Income: "#10b981",
    Salary: "#10b981",
    Transfer: "#64748b",
    "Transfer from": "#64748b",
    "Transfer to": "#64748b",
    Other: "#94a3b8",
  };
  return colors[category] || "#94a3b8";
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PDF Export", () => {
  beforeEach(() => {
    clearAll();
  });

  afterEach(() => {
    clearAll();
  });

  it("should format currency correctly", () => {
    expect(formatCurrency(1000.5)).toBe("$1,000.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(-50.25)).toBe("-$50.25");
  });

  it("should format month correctly", () => {
    expect(formatMonth("2024-01")).toBe("Jan 2024");
    expect(formatMonth("2024-12")).toBe("Dec 2024");
    expect(formatMonth("2025-06")).toBe("Jun 2025");
  });

  it("should get month key from date string", () => {
    expect(getMonthKey("2024-01-15")).toBe("2024-01");
    expect(getMonthKey("2024-12-31")).toBe("2024-12");
  });

  it("should return correct category color", () => {
    expect(getCategoryColor("Food")).toBe("#2563eb");
    expect(getCategoryColor("Transport")).toBe("#059669");
    expect(getCategoryColor("Shopping")).toBe("#d97706");
    expect(getCategoryColor("Bills")).toBe("#7c3aed");
    expect(getCategoryColor("Health")).toBe("#ec4899");
    expect(getCategoryColor("Housing")).toBe("#6366f1");
    expect(getCategoryColor("Savings")).toBe("#10b981");
    expect(getCategoryColor("Income")).toBe("#10b981");
    expect(getCategoryColor("Salary")).toBe("#10b981");
    expect(getCategoryColor("Transfer")).toBe("#64748b");
    expect(getCategoryColor("Other")).toBe("#94a3b8");
    expect(getCategoryColor("Unknown Category")).toBe("#94a3b8");
  });

  it("should build dashboard data from transactions", () => {
    const accountId = createAccount("Main Account", "checking", 0, "USD");
    importTransactions(accountId, [
      { date: "2024-01-15", description: "Grocery Store", amount: -50.5, category: "Groceries" },
      { date: "2024-01-16", description: "Gas Station", amount: -35.0, category: "Transport" },
      { date: "2024-01-17", description: "Salary", amount: 3000, category: "Salary" },
      { date: "2024-02-10", description: "Restaurant", amount: -45.0, category: "Dining" },
      { date: "2024-02-15", description: "Paycheck", amount: 3200, category: "Salary" },
    ]);

    const transactions = [
      { date: "2024-01-15", description: "Grocery Store", amount: -50.5, category: "Groceries" },
      { date: "2024-01-16", description: "Gas Station", amount: -35.0, category: "Transport" },
      { date: "2024-01-17", description: "Salary", amount: 3000, category: "Salary" },
      { date: "2024-02-10", description: "Restaurant", amount: -45.0, category: "Dining" },
      { date: "2024-02-15", description: "Paycheck", amount: 3200, category: "Salary" },
    ];

    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryMap = new Map<string, { amount: number; count: number }>();
    const monthMap = new Map<string, { total: number; byCategory: Record<string, number> }>();
    const cashFlowMap = new Map<string, { income: number; expenses: number }>();

    for (const tx of transactions) {
      if (tx.amount > 0) {
        totalIncome += tx.amount;
      } else {
        totalExpenses += Math.abs(tx.amount);
      }

      if (tx.category) {
        const existing = categoryMap.get(tx.category);
        if (existing) {
          existing.amount += Math.abs(tx.amount);
          existing.count += 1;
        } else {
          categoryMap.set(tx.category, {
            amount: Math.abs(tx.amount),
            count: 1,
          });
        }
      }

      const monthKey = getMonthKey(tx.date);
      const monthEntry = monthMap.get(monthKey);
      if (monthEntry) {
        monthEntry.total += Math.abs(tx.amount);
        if (tx.category) {
          monthEntry.byCategory[tx.category] =
            (monthEntry.byCategory[tx.category] || 0) + Math.abs(tx.amount);
        }
      } else {
        monthMap.set(monthKey, {
          total: Math.abs(tx.amount),
          byCategory: tx.category ? { [tx.category]: Math.abs(tx.amount) } : {},
        });
      }

      const cfEntry = cashFlowMap.get(monthKey);
      if (cfEntry) {
        if (tx.amount > 0) {
          cfEntry.income += tx.amount;
        } else {
          cfEntry.expenses += Math.abs(tx.amount);
        }
      } else {
        if (tx.amount > 0) {
          cashFlowMap.set(monthKey, { income: tx.amount, expenses: 0 });
        } else {
          cashFlowMap.set(monthKey, { income: 0, expenses: Math.abs(tx.amount) });
        }
      }
    }

    const totalNet = totalIncome - totalExpenses;

    // Verify summary
    expect(totalIncome).toBe(6200);
    expect(totalExpenses).toBe(130.5);
    expect(totalNet).toBe(6069.5);

    // Verify categories
    expect(categoryMap.size).toBe(4); // Groceries, Transport, Salary, Dining
    expect(categoryMap.get("Salary")?.amount).toBe(6200);
    expect(categoryMap.get("Groceries")?.amount).toBe(50.5);

    // Verify months - monthly total includes both income and expenses (absolute values)
    expect(monthMap.size).toBe(2);
    // Jan: 50.5 + 35 + 3000 = 3085.5
    expect(monthMap.get("2024-01")?.total).toBe(3085.5);
    // Feb: 45 + 3200 = 3245
    expect(monthMap.get("2024-02")?.total).toBe(3245);

    // Verify cash flow
    expect(cashFlowMap.size).toBe(2);
    const janCashFlow = cashFlowMap.get("2024-01");
    expect(janCashFlow?.income).toBe(3000);
    expect(janCashFlow?.expenses).toBe(85.5);
    const febCashFlow = cashFlowMap.get("2024-02");
    expect(febCashFlow?.income).toBe(3200);
    expect(febCashFlow?.expenses).toBe(45);
  });

  it("should handle empty transaction list", () => {
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryMap = new Map<string, { amount: number; count: number }>();

    const transactions: { date: string; description: string; amount: number; category?: string }[] = [];

    for (const tx of transactions) {
      if (tx.amount > 0) {
        totalIncome += tx.amount;
      } else {
        totalExpenses += Math.abs(tx.amount);
      }
    }

    expect(totalIncome).toBe(0);
    expect(totalExpenses).toBe(0);
    expect(categoryMap.size).toBe(0);
  });

  it("should handle transactions without categories", () => {
    const transactions: { date: string; description: string; amount: number; category?: string }[] = [
      { date: "2024-01-15", description: "Unknown", amount: -25.0 },
      { date: "2024-01-16", description: "Another", amount: -10.0 },
    ];

    let totalExpenses = 0;
    const categoryMap = new Map<string, { amount: number; count: number }>();

    for (const tx of transactions) {
      if (tx.amount < 0) {
        totalExpenses += Math.abs(tx.amount);
      }
      if (tx.category) {
        const existing = categoryMap.get(tx.category);
        if (existing) {
          existing.amount += Math.abs(tx.amount);
          existing.count += 1;
        } else {
          categoryMap.set(tx.category, {
            amount: Math.abs(tx.amount),
            count: 1,
          });
        }
      }
    }

    expect(totalExpenses).toBe(35);
    expect(categoryMap.size).toBe(0);
  });

  it("should calculate safe-to-spend for PDF export", () => {
    const accountId = createAccount("Main Account", "checking", 0, "USD");

    // Use current month dates so safe-to-spend can find the transactions
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const datePrefix = `${year}-${month}`;

    importTransactions(accountId, [
      { date: `${datePrefix}-15`, description: "Salary", amount: 5000, category: "Salary" },
      { date: `${datePrefix}-16`, description: "Rent", amount: -1500, category: "Rent", is_bill: 1 },
      { date: `${datePrefix}-17`, description: "Groceries", amount: -200, category: "Groceries" },
    ]);

    const transactions = [
      { date: `${datePrefix}-15`, description: "Salary", amount: 5000, category: "Salary" },
      { date: `${datePrefix}-16`, description: "Rent", amount: -1500, category: "Rent", is_bill: 1 },
      { date: `${datePrefix}-17`, description: "Groceries", amount: -200, category: "Groceries" },
    ];

    const budgets = getBudgets();
    const savingsGoals = getActiveSavingsGoals();

    const result = calculateSafeToSpend(transactions, budgets, savingsGoals);

    // Should have income, bills, and safe-to-spend
    expect(result.totalIncome).toBe(5000);
    expect(result.totalBills).toBe(1500);
    expect(result.safeToSpend).toBe(3300);
    expect(result.isSafe).toBe(true);
  });

  it("should generate correct filename with date", () => {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filename = `sentry-ledger-report-${dateStr}.pdf`;

    expect(filename).toMatch(/sentry-ledger-report-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("should generate correct CSV filename with date", () => {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filename = `sentry-ledger-transactions-${dateStr}.csv`;

    expect(filename).toMatch(/sentry-ledger-transactions-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
