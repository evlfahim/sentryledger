/**
 * Rule Engine
 *
 * Applies categorized rules to transactions based on description and amount.
 * Rules are matched in priority order (highest first), and the first matching
 * rule determines the category for a transaction.
 */

import type { ParsedTransaction } from "../csv/types";

// ─── Rule Types ───────────────────────────────────────────────────────────────

/**
 * A rule that can be applied to categorize transactions.
 * Mirrors the database Rule model for the engine interface.
 */
export interface Rule {
  id: string;
  name: string;
  description: string;
  regex: string;
  category: string;
  priority: number;
  isActive: boolean;
  /** Optional minimum amount filter (inclusive) */
  minAmount?: number;
  /** Optional maximum amount filter (inclusive) */
  maxAmount?: number;
  /** Optional amount direction filter */
  amountDirection?: "debit" | "credit" | "any";
}

/**
 * A transaction after rule categorization.
 */
export interface CategorizedTransaction {
  /** The original parsed transaction */
  transaction: ParsedTransaction;
  /** The matched category (null if no rule matched) */
  category: string | null;
  /** The rule that matched (null if no rule matched) */
  matchedRule: Rule | null;
  /** Whether the transaction matched any rule */
  matched: boolean;
}

/**
 * Result of running the rule engine.
 */
export interface RuleEngineResult {
  /** All transactions with their categorization results */
  results: CategorizedTransaction[];
  /** Transactions that didn't match any rule */
  uncategorized: CategorizedTransaction[];
  /** Count of transactions categorized by each category */
  categoryCounts: Record<string, number>;
}

// ─── Rule Matching ────────────────────────────────────────────────────────────

/**
 * Test if a transaction matches a single rule.
 * A rule matches if:
 * 1. The rule is active
 * 2. The transaction description matches the rule's regex
 * 3. The transaction amount satisfies min/max filters (if set)
 * 4. The transaction amount direction matches (if set)
 */
export function ruleMatches(
  rule: Rule,
  transaction: ParsedTransaction
): boolean {
  if (!rule.isActive) return false;

  // Check regex against description (case-insensitive)
  try {
    const regex = new RegExp(rule.regex, "i");
    if (!regex.test(transaction.description)) {
      return false;
    }
  } catch {
    // Invalid regex — treat as non-matching
    return false;
  }

  // Check amount direction filter
  if (rule.amountDirection && rule.amountDirection !== "any") {
    const isDebit = transaction.amountValue < 0;
    const isCredit = transaction.amountValue > 0;

    if (rule.amountDirection === "debit" && !isDebit) return false;
    if (rule.amountDirection === "credit" && !isCredit) return false;
  }

  // Check min amount filter
  if (rule.minAmount !== undefined) {
    if (Math.abs(transaction.amountValue) < rule.minAmount) {
      return false;
    }
  }

  // Check max amount filter
  if (rule.maxAmount !== undefined) {
    if (Math.abs(transaction.amountValue) > rule.maxAmount) {
      return false;
    }
  }

  return true;
}

// ─── Rule Engine ──────────────────────────────────────────────────────────────

/**
 * Apply rules to a list of transactions.
 * Rules are sorted by priority (highest first), and for each transaction,
 * the first matching rule determines the category.
 *
 * @param transactions - The parsed transactions to categorize
 * @param rules - The rules to apply
 * @returns RuleEngineResult with categorization results
 */
export function applyRules(
  transactions: ParsedTransaction[],
  rules: Rule[]
): RuleEngineResult {
  // Sort rules by priority descending (highest priority first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  const results: CategorizedTransaction[] = [];
  const uncategorized: CategorizedTransaction[] = [];
  const categoryCounts: Record<string, number> = {};

  for (const transaction of transactions) {
    let matchedRule: Rule | null = null;

    for (const rule of sortedRules) {
      if (ruleMatches(rule, transaction)) {
        matchedRule = rule;
        break;
      }
    }

    const categorized: CategorizedTransaction = {
      transaction,
      category: matchedRule ? matchedRule.category : null,
      matchedRule,
      matched: matchedRule !== null,
    };

    results.push(categorized);

    if (matchedRule) {
      const cat = matchedRule.category;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    } else {
      uncategorized.push(categorized);
    }
  }

  return { results, uncategorized, categoryCounts };
}

// ─── Rule Testing (Preview) ───────────────────────────────────────────────────

/**
 * Test a single rule against a single transaction without applying it.
 * Returns whether the rule would match.
 */
export function testRule(
  rule: Rule,
  transaction: ParsedTransaction
): boolean {
  return ruleMatches(rule, transaction);
}

/**
 * Test a rule against multiple transactions and return match counts.
 */
export function testRuleAgainstTransactions(
  rule: Rule,
  transactions: ParsedTransaction[]
): { matches: number; total: number; matchedTransactions: ParsedTransaction[] } {
  const matched: ParsedTransaction[] = [];

  for (const tx of transactions) {
    if (ruleMatches(rule, tx)) {
      matched.push(tx);
    }
  }

  return {
    matches: matched.length,
    total: transactions.length,
    matchedTransactions: matched,
  };
}

// ─── Rule Compilation ─────────────────────────────────────────────────────────

/**
 * Validate a rule's regex pattern.
 * Returns null if valid, or an error string if invalid.
 */
export function validateRuleRegex(
  regex: string
): string | null {
  try {
    new RegExp(regex, "i");
    return null;
  } catch (e) {
    return `Invalid regex: ${(e as Error).message}`;
  }
}

/**
 * Validate a complete rule object.
 * Returns an array of error strings (empty if valid).
 */
export function validateRule(rule: Partial<Rule>): string[] {
  const errors: string[] = [];

  if (!rule.name || rule.name.trim() === "") {
    errors.push("Rule name is required");
  }

  if (!rule.regex || rule.regex.trim() === "") {
    errors.push("Regex pattern is required");
  } else {
    const regexError = validateRuleRegex(rule.regex);
    if (regexError) {
      errors.push(regexError);
    }
  }

  if (!rule.category || rule.category.trim() === "") {
    errors.push("Category is required");
  }

  if (rule.minAmount !== undefined && rule.maxAmount !== undefined) {
    if (rule.minAmount > rule.maxAmount) {
      errors.push("Min amount must be less than or equal to max amount");
    }
  }

  return errors;
}

// ─── Default Rules ────────────────────────────────────────────────────────────

/**
 * Built-in default rules that come with the application.
 * These provide sensible defaults for common spending categories.
 */
export const DEFAULT_RULES: Rule[] = [
  {
    id: "builtin-grocery",
    name: "Groceries",
    description: "Grocery stores and food markets",
    regex: "grocery|supermarket|whole foods|trader joe|safeway|kroger|aldi|food market|fresh market",
    category: "Groceries",
    priority: 100,
    isActive: true,
  },
  {
    id: "builtin-restaurant",
    name: "Restaurants",
    description: "Dining out and fast food",
    regex: "restaurant|cafe|coffee|starbucks|mcdonalds|chipotle|panera|diner|pub|brewery|pizza|taco|burger|sushi|indian food|chinese food|thai food|mexican food",
    category: "Restaurants",
    priority: 100,
    isActive: true,
  },
  {
    id: "builtin-gas",
    name: "Gas & Fuel",
    description: "Gas stations and fuel purchases",
    regex: "gas|shell|chevron|bp|exxon|mobil|sunoco|fuel|petrol",
    category: "Gas & Fuel",
    priority: 100,
    isActive: true,
  },
  {
    id: "builtin-transport",
    name: "Transportation",
    description: "Public transit, rideshare, parking",
    regex: "uber|lyft|taxi|transit|metro|bus|train|parking|toll|muni|bart|subway",
    category: "Transportation",
    priority: 100,
    isActive: true,
  },
  {
    id: "builtin-utilities",
    name: "Utilities",
    description: "Electric, water, gas, internet bills",
    regex: "electric|water|gas utility|internet|comcast|verizon|at&t|spectrum|cox|utility",
    category: "Utilities",
    priority: 100,
    isActive: true,
  },
  {
    id: "builtin-insurance",
    name: "Insurance",
    description: "Health, auto, home insurance",
    regex: "insurance|health plan|auto insurance|home insurance|life insurance",
    category: "Insurance",
    priority: 100,
    isActive: true,
  },
  {
    id: "builtin-rent",
    name: "Rent/Mortgage",
    description: "Rent and mortgage payments",
    regex: "rent|mortgage|property tax|homestead",
    category: "Housing",
    priority: 100,
    isActive: true,
  },
  {
    id: "builtin-streaming",
    name: "Streaming & Subscriptions",
    description: "Netflix, Spotify, and other subscriptions",
    regex: "netflix|spotify|hulu|disney|amazon prime|apple music|youtube premium|subscription",
    category: "Subscriptions",
    priority: 90,
    isActive: true,
  },
  {
    id: "builtin-pharmacy",
    name: "Pharmacy & Health",
    description: "Pharmacy and health-related purchases",
    regex: "pharmacy|cvs|walgreens|rite aid|health|hospital|clinic|doctor|dentist",
    category: "Health",
    priority: 100,
    isActive: true,
  },
  {
    id: "builtin-shopping",
    name: "Shopping",
    description: "General retail and online shopping",
    regex: "amazon|walmart|target|costco|best buy|home depot|lowes|nordstrom|macys",
    category: "Shopping",
    priority: 100,
    isActive: true,
  },
  {
    id: "builtin-income",
    name: "Income",
    description: "Salary, deposits, and income",
    regex: "salary|payroll|direct deposit|deposit|refund|tax refund",
    category: "Income",
    priority: 100,
    isActive: true,
    amountDirection: "credit",
  },
  {
    id: "builtin-transfer",
    name: "Transfers",
    description: "Account transfers",
    regex: "transfer|transferred|from |to ",
    category: "Transfers",
    priority: 50,
    isActive: true,
  },
];

// ─── Bill Detection ───────────────────────────────────────────────────────────

/**
 * Recurring bill patterns that indicate a bill rather than a regular purchase.
 * Used to mark transactions as bills for the safe-to-spend calculator.
 */
export const BILL_KEYWORDS = [
  "rent",
  "mortgage",
  "insurance",
  "utility",
  "electric",
  "water",
  "internet",
  "phone",
  "subscription",
  "netflix",
  "spotify",
  "hulu",
  "disney",
  "amazon prime",
  "lease",
  "payment due",
  "auto pay",
];

/**
 * Check if a transaction description matches a known bill pattern.
 */
export function isBill(transaction: ParsedTransaction): boolean {
  const lower = transaction.description.toLowerCase();
  return BILL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Apply bill detection to a list of transactions.
 * Returns transactions with the isBill flag set.
 */
export function detectBills(
  transactions: ParsedTransaction[]
): { transaction: ParsedTransaction; isBill: boolean }[] {
  return transactions.map((tx) => ({
    transaction: tx,
    isBill: isBill(tx),
  }));
}
