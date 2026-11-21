/**
 * CSV Parser Tests
 *
 * Comprehensive tests for date parsing, amount parsing, bank profile detection,
 * column mapping wizard, transaction parsing, and duplicate detection.
 */

import { describe, it, expect } from "vitest";
import {
  parseDate,
  parseAmount,
  readCsvFile,
  parseTransactions,
  findDuplicates,
  exportToCsv,
  parseCsvFile,
  parseWithMapping,
  createWizardState,
  updateWizardMapping,
  detectBankProfile,
  BANK_PROFILES,
} from "@/lib/csv";
import type { ColumnMapping, CsvFile, ParsedTransaction } from "@/lib/csv";

// ─── Date Parsing Tests ───────────────────────────────────────────────────────

describe("parseDate", () => {
  it("should parse MM/DD/YYYY format", () => {
    const result = parseDate("01/15/2024");
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(0); // January is 0
    expect(result!.getDate()).toBe(15);
    expect(result!.getFullYear()).toBe(2024);
  });

  it("should parse single-digit month/day in MM/DD/YYYY", () => {
    const result = parseDate("1/5/2024");
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(5);
  });

  it("should parse YYYY-MM-DD format", () => {
    const result = parseDate("2024-03-20");
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(2); // March
    expect(result!.getDate()).toBe(20);
    expect(result!.getFullYear()).toBe(2024);
  });

  it("should parse DD.MM.YYYY format", () => {
    const result = parseDate("15.06.2024");
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(5); // June
    expect(result!.getDate()).toBe(15);
  });

  it("should parse DD-MM-YYYY format", () => {
    const result = parseDate("20-03-2024");
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(2); // March
    expect(result!.getDate()).toBe(20);
  });

  it("should parse 'Mon DD, YYYY' format", () => {
    const result = parseDate("Jan 15, 2024");
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(15);
  });

  it("should parse 'Month DD, YYYY' format", () => {
    const result = parseDate("December 25, 2024");
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(11); // December
    expect(result!.getDate()).toBe(25);
  });

  it("should parse 'DD Mon YYYY' format", () => {
    const result = parseDate("15 Jun 2024");
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(5);
    expect(result!.getDate()).toBe(15);
  });

  it("should return null for invalid dates", () => {
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("  ")).toBeNull();
    expect(parseDate("2024-13-01")).toBeNull(); // Invalid month
    expect(parseDate("2024-02-30")).toBeNull(); // Invalid day
  });

  it("should handle native Date fallback", () => {
    const result = parseDate("March 15, 2024");
    expect(result).not.toBeNull();
  });
});

// ─── Amount Parsing Tests ─────────────────────────────────────────────────────

describe("parseAmount", () => {
  it("should parse simple decimal", () => {
    expect(parseAmount("100.50")).toBe(100.5);
    expect(parseAmount("0.99")).toBe(0.99);
  });

  it("should parse negative amounts", () => {
    expect(parseAmount("-50.25")).toBe(-50.25);
  });

  it("should parse amounts with dollar sign", () => {
    expect(parseAmount("$100.00")).toBe(100);
    expect(parseAmount("-$25.50")).toBe(-25.5);
  });

  it("should parse amounts with euro sign", () => {
    expect(parseAmount("€75.00")).toBe(75);
  });

  it("should parse accounting format (parentheses)", () => {
    expect(parseAmount("(100.50)")).toBe(-100.5);
    expect(parseAmount("(25.00)")).toBe(-25);
  });

  it("should parse US format with commas", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("10,000.00")).toBe(10000);
  });

  it("should parse European format with comma as decimal", () => {
    expect(parseAmount("100,50")).toBe(100.5);
    expect(parseAmount("1.234,56")).toBe(1234.56);
  });

  it("should handle empty and zero amounts", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("-")).toBe(0);
    expect(parseAmount("0")).toBe(0);
  });

  it("should return null for unparseable strings", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("$$")).toBeNull();
  });
});

// ─── CSV File Reading Tests ──────────────────────────────────────────────────

describe("readCsvFile", () => {
  it("should parse a simple CSV", () => {
    const csv = "Date,Description,Amount\n2024-01-15,Grocery Store,-50.00\n2024-01-16,Salary,3000.00";
    const result = readCsvFile(csv, "test.csv");

    expect(result.fileName).toBe("test.csv");
    expect(result.columns).toEqual(["Date", "Description", "Amount"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      Date: "2024-01-15",
      Description: "Grocery Store",
      Amount: "-50.00",
    });
  });

  it("should skip empty lines", () => {
    const csv = "Date,Amount\n2024-01-01,100\n\n2024-01-02,200";
    const result = readCsvFile(csv, "test.csv");
    expect(result.rows).toHaveLength(2);
  });

  it("should handle quoted fields", () => {
    const csv = 'Date,Description,Amount\n2024-01-01,"Coffee, Tea",5.50';
    const result = readCsvFile(csv, "test.csv");
    expect(result.rows[0].Description).toBe("Coffee, Tea");
  });
});

// ─── Bank Profile Detection Tests ────────────────────────────────────────────

describe("detectBankProfile", () => {
  it("should detect Chase format", () => {
    const columns = ["Transaction Date", "Description", "Amount"];
    const result = detectBankProfile(columns, BANK_PROFILES);
    expect(result?.name).toBe("Chase");
  });

  it("should detect Bank of America format", () => {
    const columns = ["Date", "Description", "Amount"];
    const result = detectBankProfile(columns, BANK_PROFILES);
    expect(result).not.toBeNull();
  });

  it("should return null for unknown formats", () => {
    const columns = ["col1", "col2", "col3"];
    const result = detectBankProfile(columns, BANK_PROFILES);
    expect(result).toBeNull();
  });

  it("should be case-insensitive", () => {
    const columns = ["DATE", "DESCRIPTION", "AMOUNT"];
    const result = detectBankProfile(columns, BANK_PROFILES);
    expect(result).not.toBeNull();
  });
});

// ─── Column Mapping Wizard Tests ─────────────────────────────────────────────

describe("createWizardState", () => {
  it("should create wizard state with auto-detected mapping", () => {
    const csv = "Transaction Date,Description,Amount\n2024-01-15,Grocery,-50.00";
    const csvFile = readCsvFile(csv, "test.csv");
    const wizard = createWizardState(csvFile);

    expect(wizard.availableColumns).toEqual(["Transaction Date", "Description", "Amount"]);
    expect(wizard.mapping.date).toBe("Transaction Date");
    expect(wizard.mapping.description).toBe("Description");
    expect(wizard.mapping.amount).toBe("Amount");
    expect(wizard.preview).toHaveLength(1);
  });

  it("should auto-map columns by keyword matching", () => {
    const csv = "Date,Payee,Withdrawal\n2024-01-15,Store,-100.00";
    const csvFile = readCsvFile(csv, "test.csv");
    const wizard = createWizardState(csvFile);

    expect(wizard.mapping.date).toBe("Date");
    expect(wizard.mapping.description).toBe("Payee");
    expect(wizard.mapping.amount).toBe("Withdrawal");
  });

  it("should generate warnings for unparseable dates", () => {
    const csv = "Date,Description,Amount\ninvalid,Grocery,-50.00";
    const csvFile = readCsvFile(csv, "test.csv");
    const wizard = createWizardState(csvFile);

    expect(wizard.warnings.length).toBeGreaterThan(0);
    expect(wizard.warnings[0]).toContain("Could not parse date");
  });
});

describe("updateWizardMapping", () => {
  it("should update mapping and regenerate preview", () => {
    const csv = "Transaction Date,Description,Amount\n2024-01-15,Grocery,-50.00";
    const csvFile = readCsvFile(csv, "test.csv");

    // Start with empty mapping
    const wizard1 = updateWizardMapping(csvFile, {}, []);
    expect(wizard1.preview).toHaveLength(0);

    // Update with proper mapping
    const wizard2 = updateWizardMapping(csvFile, {
      date: "Transaction Date",
      description: "Description",
      amount: "Amount",
    }, []);

    expect(wizard2.preview).toHaveLength(1);
    expect(wizard2.preview[0].description).toBe("Grocery");
  });
});

// ─── Transaction Parsing Tests ────────────────────────────────────────────────

describe("parseTransactions", () => {
  it("should parse transactions with valid mapping", () => {
    const csv = "Date,Description,Amount\n2024-01-15,Grocery,-50.00\n2024-01-16,Salary,3000.00";
    const csvFile = readCsvFile(csv, "test.csv");
    const mapping: ColumnMapping = {
      date: "Date",
      description: "Description",
      amount: "Amount",
    };

    const { transactions, warnings } = parseTransactions(csvFile, mapping);

    expect(transactions).toHaveLength(2);
    expect(transactions[0].description).toBe("Grocery");
    expect(transactions[0].amountValue).toBe(-50);
    expect(transactions[0].isCredit).toBe(false);
    expect(transactions[1].amountValue).toBe(3000);
    expect(transactions[1].isCredit).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("should skip empty rows", () => {
    const csv = "Date,Description,Amount\n2024-01-15,Grocery,-50.00\n,,\n2024-01-16,Salary,3000.00";
    const csvFile = readCsvFile(csv, "test.csv");
    const mapping: ColumnMapping = {
      date: "Date",
      description: "Description",
      amount: "Amount",
    };

    const { transactions } = parseTransactions(csvFile, mapping);
    expect(transactions).toHaveLength(2);
  });

  it("should generate warnings for invalid dates", () => {
    const csv = "Date,Description,Amount\nbad date,Grocery,-50.00";
    const csvFile = readCsvFile(csv, "test.csv");
    const mapping: ColumnMapping = {
      date: "Date",
      description: "Description",
      amount: "Amount",
    };

    const { warnings } = parseTransactions(csvFile, mapping);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("should generate warnings for invalid amounts", () => {
    const csv = "Date,Description,Amount\n2024-01-15,Grocery,abc";
    const csvFile = readCsvFile(csv, "test.csv");
    const mapping: ColumnMapping = {
      date: "Date",
      description: "Description",
      amount: "Amount",
    };

    const { warnings } = parseTransactions(csvFile, mapping);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("should return empty result with warning if mapping is incomplete", () => {
    const csv = "Date,Description,Amount\n2024-01-15,Grocery,-50.00";
    const csvFile = readCsvFile(csv, "test.csv");
    const mapping: ColumnMapping = { date: "Date" };

    const { transactions, warnings } = parseTransactions(csvFile, mapping);
    expect(transactions).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

// ─── Duplicate Detection Tests ────────────────────────────────────────────────

describe("findDuplicates", () => {
  it("should detect duplicates by date, description, and amount", () => {
    const transactions: ParsedTransaction[] = [
      {
        date: "2024-01-15",
        description: "Grocery Store",
        amount: "-50.00",
        amountValue: -50,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
      {
        date: "2024-01-15",
        description: "Grocery Store",
        amount: "-50.00",
        amountValue: -50,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
      {
        date: "2024-01-16",
        description: "Salary",
        amount: "3000.00",
        amountValue: 3000,
        dateValue: new Date(2024, 0, 16),
        isCredit: true,
      },
    ];

    const duplicates = findDuplicates(transactions);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].csvRowIndex).toBe(1);
    expect(duplicates[0].duplicateWith).toBe(0);
  });

  it("should not flag different transactions as duplicates", () => {
    const transactions: ParsedTransaction[] = [
      {
        date: "2024-01-15",
        description: "Grocery Store",
        amount: "-50.00",
        amountValue: -50,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
      {
        date: "2024-01-15",
        description: "Gas Station",
        amount: "-30.00",
        amountValue: -30,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
    ];

    const duplicates = findDuplicates(transactions);
    expect(duplicates).toHaveLength(0);
  });

  it("should ignore transactions with zero amount", () => {
    const transactions: ParsedTransaction[] = [
      {
        date: "2024-01-15",
        description: "Transfer",
        amount: "0",
        amountValue: 0,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
      {
        date: "2024-01-15",
        description: "Transfer",
        amount: "0",
        amountValue: 0,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
    ];

    const duplicates = findDuplicates(transactions);
    expect(duplicates).toHaveLength(0);
  });

  it("should be case-insensitive for descriptions", () => {
    const transactions: ParsedTransaction[] = [
      {
        date: "2024-01-15",
        description: "GROCERY STORE",
        amount: "-50.00",
        amountValue: -50,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
      {
        date: "2024-01-15",
        description: "grocery store",
        amount: "-50.00",
        amountValue: -50,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
    ];

    const duplicates = findDuplicates(transactions);
    expect(duplicates).toHaveLength(1);
  });
});

// ─── Export Tests ─────────────────────────────────────────────────────────────

describe("exportToCsv", () => {
  it("should export transactions to CSV format", () => {
    const transactions: ParsedTransaction[] = [
      {
        date: "2024-01-15",
        description: "Grocery Store",
        amount: "-50.00",
        amountValue: -50,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
      {
        date: "2024-01-16",
        description: "Salary",
        amount: "3000.00",
        amountValue: 3000,
        dateValue: new Date(2024, 0, 16),
        isCredit: true,
      },
    ];

    const csv = exportToCsv(transactions);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("Date,Description,Amount");
    expect(lines[1]).toContain("2024-01-15");
    expect(lines[1]).toContain("Grocery Store");
    expect(lines[2]).toContain("2024-01-16");
    expect(lines[2]).toContain("Salary");
  });

  it("should handle descriptions with commas", () => {
    const transactions: ParsedTransaction[] = [
      {
        date: "2024-01-15",
        description: "Coffee, Tea, and More",
        amount: "5.50",
        amountValue: 5.5,
        dateValue: new Date(2024, 0, 15),
        isCredit: false,
      },
    ];

    const csv = exportToCsv(transactions);
    expect(csv).toContain('"Coffee, Tea, and More"');
  });
});

// ─── High-Level API Tests ────────────────────────────────────────────────────

describe("parseCsvFile", () => {
  it("should auto-detect bank and parse transactions", () => {
    const csv = "Transaction Date,Description,Amount\n2024-01-15,Grocery,-50.00\n2024-01-16,Salary,3000.00";
    const result = parseCsvFile(csv, "chase_statement.csv");

    expect(result.autoDetected).toBe(true);
    expect(result.detectedBank).toBe("Chase");
    expect(result.transactions).toHaveLength(2);
    expect(result.mappingRequired).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it("should require mapping for unknown formats", () => {
    const csv = "col1,col2,col3\nvalue1,value2,value3";
    const result = parseCsvFile(csv, "unknown.csv");

    expect(result.autoDetected).toBe(false);
    expect(result.mappingRequired).toBe(true);
  });
});

describe("parseWithMapping", () => {
  it("should parse using explicit column mapping", () => {
    const csv = "Transaction Date,Description,Amount\n2024-01-15,Grocery,-50.00";
    const result = parseWithMapping(
      csv,
      "test.csv",
      {
        date: "Transaction Date",
        description: "Description",
        amount: "Amount",
      }
    );

    expect(result.autoDetected).toBe(false);
    expect(result.mappingRequired).toBe(false);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("Grocery");
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("should handle CSV with extra columns", () => {
    const csv = "Date,Description,Amount,Category,Reference\n2024-01-15,Grocery,-50.00,Food,REF001";
    const csvFile = readCsvFile(csv, "test.csv");
    const mapping: ColumnMapping = {
      date: "Date",
      description: "Description",
      amount: "Amount",
    };

    const { transactions } = parseTransactions(csvFile, mapping);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].description).toBe("Grocery");
  });

  it("should handle large CSV files", () => {
    let csv = "Date,Description,Amount\n";
    for (let i = 0; i < 1000; i++) {
      csv += `2024-01-${String(i % 28 + 1).padStart(2, "0")},Transaction ${i},-${(i * 1.5).toFixed(2)}\n`;
    }

    const result = parseCsvFile(csv, "large.csv");
    expect(result.transactions).toHaveLength(1000);
  });

  it("should handle special characters in descriptions", () => {
    const csv = "Date,Description,Amount\n2024-01-15,\"Taco Bell® - Order #12345\",-12.99";
    const csvFile = readCsvFile(csv, "test.csv");
    const mapping: ColumnMapping = {
      date: "Date",
      description: "Description",
      amount: "Amount",
    };

    const { transactions } = parseTransactions(csvFile, mapping);
    expect(transactions[0].description).toBe("Taco Bell® - Order #12345");
  });
});
