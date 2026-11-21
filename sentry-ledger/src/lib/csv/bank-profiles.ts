/**
 * Bank CSV Profiles
 *
 * Known bank CSV formats with their column name patterns for auto-detection.
 * Column name matching is case-insensitive and supports partial matching.
 */

import { BankProfile } from "./types";

/**
 * Check if a column name matches any of the given patterns.
 * All patterns must match (AND logic within a profile).
 */
function matchesColumn(columnName: string, patterns: string[]): boolean {
  const lower = columnName.toLowerCase().trim();
  return patterns.every((pattern) => lower.includes(pattern.toLowerCase()));
}

/**
 * Check if a set of columns matches a bank profile.
 * At least one pattern group must match (OR logic between groups).
 */
export function detectBankProfile(
  columns: string[],
  profiles: BankProfile[]
): BankProfile | null {
  for (const profile of profiles) {
    // Each profile has one or more pattern groups.
    // A profile matches if at least one group has all its patterns matching some column.
    for (const patternGroup of profile.columnPatterns) {
      let groupMatch = 0;
      for (const pattern of patternGroup) {
        if (columns.some((col) => matchesColumn(col, [pattern]))) {
          groupMatch++;
        }
      }
      // All patterns in the group must match
      if (groupMatch === patternGroup.length) {
        return profile;
      }
    }
  }
  return null;
}

/**
 * All known bank profiles.
 */
export const BANK_PROFILES: BankProfile[] = [
  {
    name: "Chase",
    columnPatterns: [
      ["transaction date", "date"],
      ["description", "memo", "payee", "name"],
      ["amount", "debit", "credit"],
    ],
    defaultMapping: {
      date: "Transaction Date",
      description: "Description",
      amount: "Amount",
    },
  },
  {
    name: "Bank of America",
    columnPatterns: [
      ["date", "posted date", "transaction date"],
      ["description", "memo", "payee", "name", "details"],
      ["amount", "debit amount", "credit amount", "withdrawal", "deposit"],
    ],
    defaultMapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
    },
  },
  {
    name: "Wells Fargo",
    columnPatterns: [
      ["date", "transaction date", "post date"],
      ["description", "memo", "payee", "name", "details"],
      ["amount", "debit", "credit", "withdrawal", "deposit"],
    ],
    defaultMapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
    },
  },
  {
    name: "Capital One",
    columnPatterns: [
      ["date", "transaction date", "post date"],
      ["description", "memo", "payee", "name", "details"],
      ["amount", "debit", "credit", "purchase", "payment"],
    ],
    defaultMapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
    },
  },
  {
    name: "Citibank",
    columnPatterns: [
      ["date", "transaction date", "post date"],
      ["description", "memo", "payee", "name", "details"],
      ["amount", "debit", "credit", "purchase", "payment"],
    ],
    defaultMapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
    },
  },
  {
    name: "US Bank",
    columnPatterns: [
      ["date", "transaction date", "post date"],
      ["description", "memo", "payee", "name", "details"],
      ["amount", "debit", "credit", "withdrawal", "deposit"],
    ],
    defaultMapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
    },
  },
  {
    name: "TD Bank",
    columnPatterns: [
      ["date", "transaction date", "post date"],
      ["description", "memo", "payee", "name", "details"],
      ["amount", "debit", "credit", "withdrawal", "deposit"],
    ],
    defaultMapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
    },
  },
  {
    name: "Ally Bank",
    columnPatterns: [
      ["date", "transaction date", "post date"],
      ["description", "memo", "payee", "name", "details"],
      ["amount", "debit", "credit", "withdrawal", "deposit"],
    ],
    defaultMapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
    },
  },
  {
    name: "Credit Union (General)",
    columnPatterns: [
      ["date", "transaction date", "post date"],
      ["description", "memo", "payee", "name", "details"],
      ["amount", "debit", "credit", "withdrawal", "deposit"],
    ],
    defaultMapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
    },
  },
  {
    name: "Generic / Other",
    columnPatterns: [
      ["date"],
      ["description", "memo", "payee", "name"],
      ["amount", "debit", "credit", "withdrawal", "deposit"],
    ],
    defaultMapping: {},
  },
];

/**
 * Get a bank profile by name.
 */
export function getBankProfileByName(name: string): BankProfile | undefined {
  return BANK_PROFILES.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get all bank profile names for UI display.
 */
export function getBankProfileNames(): string[] {
  return BANK_PROFILES.map((p) => p.name);
}
