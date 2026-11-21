/**
 * Tests for CSV export functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clearAll,
  createAccount,
  importTransactions,
  type TransactionRow,
} from "@/lib/import/db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvHeader(): string {
  return ["Date", "Description", "Amount", "Category", "Is Bill", "Is Duplicate", "Account"].join(",");
}

function buildCsvRow(tx: TransactionRow, accountName: string): string {
  return [
    escapeCsvField(tx.date),
    escapeCsvField(tx.description),
    escapeCsvField(tx.amount.toFixed(2)),
    escapeCsvField(tx.category),
    escapeCsvField(tx.is_bill ? "Yes" : "No"),
    escapeCsvField(tx.is_duplicate ? "Yes" : "No"),
    escapeCsvField(accountName),
  ].join(",");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CSV Export", () => {
  beforeEach(() => {
    clearAll();
  });

  afterEach(() => {
    clearAll();
  });

  it("should generate correct CSV header", () => {
    const header = buildCsvHeader();
    const columns = header.split(",");
    expect(columns).toEqual(["Date", "Description", "Amount", "Category", "Is Bill", "Is Duplicate", "Account"]);
  });

  it("should escape fields containing commas", () => {
    const escaped = escapeCsvField("Grocery Store, Main St");
    expect(escaped).toBe('"Grocery Store, Main St"');
  });

  it("should escape fields containing double quotes", () => {
    const escaped = escapeCsvField('He said "hello"');
    expect(escaped).toBe('"He said ""hello"""');
  });

  it("should escape fields containing newlines", () => {
    const escaped = escapeCsvField("Line 1\nLine 2");
    expect(escaped).toBe('"Line 1\nLine 2"');
  });

  it("should return empty string for null/undefined values", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("should not escape simple values", () => {
    expect(escapeCsvField("Hello")).toBe("Hello");
    expect(escapeCsvField(42)).toBe("42");
  });

  it("should build a correct CSV row", () => {
    const tx: TransactionRow = {
      id: "test-id",
      account_id: "acc-1",
      date: "2024-01-15",
      description: "Grocery Store",
      amount: -50.5,
      category: "Groceries",
      rule_id: null,
      is_bill: 0,
      is_duplicate: 0,
      created_at: "2024-01-15T00:00:00.000Z",
      updated_at: "2024-01-15T00:00:00.000Z",
    };

    const row = buildCsvRow(tx, "Main Account");
    expect(row).toBe(`2024-01-15,Grocery Store,-50.50,Groceries,No,No,Main Account`);
  });

  it("should build a CSV row with special characters in category", () => {
    const tx: TransactionRow = {
      id: "test-id",
      account_id: "acc-1",
      date: "2024-01-15",
      description: "Test",
      amount: 10,
      category: "Food & Dining",
      rule_id: null,
      is_bill: 0,
      is_duplicate: 0,
      created_at: "2024-01-15T00:00:00.000Z",
      updated_at: "2024-01-15T00:00:00.000Z",
    };

    const row = buildCsvRow(tx, "Main Account");
    // & does not require quoting in CSV, but comma does
    expect(row).toBe(`2024-01-15,Test,10.00,Food & Dining,No,No,Main Account`);
  });

  it("should quote category with comma", () => {
    const tx: TransactionRow = {
      id: "test-id",
      account_id: "acc-1",
      date: "2024-01-15",
      description: "Test",
      amount: 10,
      category: "Food, Dining",
      rule_id: null,
      is_bill: 0,
      is_duplicate: 0,
      created_at: "2024-01-15T00:00:00.000Z",
      updated_at: "2024-01-15T00:00:00.000Z",
    };

    const row = buildCsvRow(tx, "Main Account");
    expect(row).toBe(`2024-01-15,Test,10.00,"Food, Dining",No,No,Main Account`);
  });

  it("should build a complete CSV with header and rows", () => {
    const accountId = createAccount("Main Account", "checking", 0, "USD");
    importTransactions(accountId, [
      { date: "2024-01-15", description: "Grocery Store", amount: -50.5, category: "Groceries" },
      { date: "2024-01-16", description: "Gas Station", amount: -35.0, category: "Transport" },
      { date: "2024-01-17", description: "Salary", amount: 3000, category: "Salary" },
    ]);

    const transactions = [
      { date: "2024-01-15", description: "Grocery Store", amount: -50.5, category: "Groceries" },
      { date: "2024-01-16", description: "Gas Station", amount: -35.0, category: "Transport" },
      { date: "2024-01-17", description: "Salary", amount: 3000, category: "Salary" },
    ];

    const rows = transactions.map((tx) =>
      buildCsvRow({
        id: "test",
        account_id: accountId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category,
        rule_id: null,
        is_bill: 0,
        is_duplicate: 0,
        created_at: "",
        updated_at: "",
      }, "Main Account")
    );

    const csvContent = [buildCsvHeader(), ...rows].join("\n");

    expect(csvContent).toContain("Date,Description,Amount,Category,Is Bill,Is Duplicate,Account");
    expect(csvContent).toContain("2024-01-15,Grocery Store,-50.50,Groceries,No,No,Main Account");
    expect(csvContent).toContain("2024-01-16,Gas Station,-35.00,Transport,No,No,Main Account");
    expect(csvContent).toContain("2024-01-17,Salary,3000.00,Salary,No,No,Main Account");
  });

  it("should handle transactions with bill flag", () => {
    const tx: TransactionRow = {
      id: "test-id",
      account_id: "acc-1",
      date: "2024-01-15",
      description: "Electric Bill",
      amount: -85.0,
      category: "Utilities",
      rule_id: null,
      is_bill: 1,
      is_duplicate: 0,
      created_at: "2024-01-15T00:00:00.000Z",
      updated_at: "2024-01-15T00:00:00.000Z",
    };

    const row = buildCsvRow(tx, "Main Account");
    expect(row).toContain("Electric Bill");
    expect(row).toContain("Yes"); // Is Bill
    expect(row).toContain("No"); // Is Duplicate
  });

  it("should handle transactions with duplicate flag", () => {
    const tx: TransactionRow = {
      id: "test-id",
      account_id: "acc-1",
      date: "2024-01-15",
      description: "Duplicate Transaction",
      amount: -25.0,
      category: "Shopping",
      rule_id: null,
      is_bill: 0,
      is_duplicate: 1,
      created_at: "2024-01-15T00:00:00.000Z",
      updated_at: "2024-01-15T00:00:00.000Z",
    };

    const row = buildCsvRow(tx, "Main Account");
    expect(row).toContain("Duplicate Transaction");
    expect(row).toContain("No"); // Is Bill
    expect(row).toContain("Yes"); // Is Duplicate
  });

  it("should handle null category", () => {
    const tx: TransactionRow = {
      id: "test-id",
      account_id: "acc-1",
      date: "2024-01-15",
      description: "Uncategorized",
      amount: -10.0,
      category: null,
      rule_id: null,
      is_bill: 0,
      is_duplicate: 0,
      created_at: "2024-01-15T00:00:00.000Z",
      updated_at: "2024-01-15T00:00:00.000Z",
    };

    const row = buildCsvRow(tx, "Main Account");
    expect(row).toContain("Uncategorized");
    expect(row).toContain(",No,No,Main Account"); // Empty category field
  });
});
