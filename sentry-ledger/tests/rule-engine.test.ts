/**
 * Rule Engine Tests
 *
 * Comprehensive tests for rule matching, the rule engine, rule validation,
 * bill detection, and default rules.
 */

import { describe, it, expect } from "vitest";
import {
  ruleMatches,
  applyRules,
  testRule,
  testRuleAgainstTransactions,
  validateRuleRegex,
  validateRule,
  DEFAULT_RULES,
  isBill,
  detectBills,
} from "@/lib/rules";
import type { Rule } from "@/lib/rules";
import type { ParsedTransaction } from "@/lib/csv";

// ─── Helper: Create a test transaction ────────────────────────────────────────

function makeTransaction(
  description: string,
  amount: number,
  date = "2024-01-15"
): ParsedTransaction {
  return {
    date,
    description,
    amount: amount.toString(),
    amountValue: amount,
    dateValue: new Date(date),
    isCredit: amount > 0,
  };
}

// ─── Rule Matching Tests ──────────────────────────────────────────────────────

describe("ruleMatches", () => {
  it("should match a simple regex against description", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "grocery",
      category: "Groceries",
      priority: 100,
      isActive: true,
    };

    const tx = makeTransaction("Grocery Store", -50);
    expect(ruleMatches(rule, tx)).toBe(true);
  });

  it("should be case-insensitive", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "grocery",
      category: "Groceries",
      priority: 100,
      isActive: true,
    };

    const tx = makeTransaction("GROCERY STORE", -50);
    expect(ruleMatches(rule, tx)).toBe(true);
  });

  it("should not match when regex does not match", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "grocery",
      category: "Groceries",
      priority: 100,
      isActive: true,
    };

    const tx = makeTransaction("Gas Station", -30);
    expect(ruleMatches(rule, tx)).toBe(false);
  });

  it("should not match inactive rules", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "grocery",
      category: "Groceries",
      priority: 100,
      isActive: false,
    };

    const tx = makeTransaction("Grocery Store", -50);
    expect(ruleMatches(rule, tx)).toBe(false);
  });

  it("should handle regex with special characters", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "coffee\\s+shop",
      category: "Restaurants",
      priority: 100,
      isActive: true,
    };

    const tx = makeTransaction("coffee shop latte", -5);
    expect(ruleMatches(rule, tx)).toBe(true);
  });

  it("should handle regex with anchors", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "^starbucks$",
      category: "Restaurants",
      priority: 100,
      isActive: true,
    };

    const tx1 = makeTransaction("starbucks", -5);
    const tx2 = makeTransaction("starbucks downtown", -5);

    expect(ruleMatches(rule, tx1)).toBe(true);
    expect(ruleMatches(rule, tx2)).toBe(false);
  });

  it("should filter by amount direction debit", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "grocery",
      category: "Groceries",
      priority: 100,
      isActive: true,
      amountDirection: "debit",
    };

    expect(ruleMatches(rule, makeTransaction("Grocery Store", -50))).toBe(true);
    expect(ruleMatches(rule, makeTransaction("Grocery Store", 50))).toBe(false);
  });

  it("should filter by amount direction credit", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "salary",
      category: "Income",
      priority: 100,
      isActive: true,
      amountDirection: "credit",
    };

    expect(ruleMatches(rule, makeTransaction("Salary Deposit", 3000))).toBe(true);
    expect(ruleMatches(rule, makeTransaction("Salary Refund", -3000))).toBe(false);
  });

  it("should filter by amount direction any", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "transfer",
      category: "Transfers",
      priority: 100,
      isActive: true,
      amountDirection: "any",
    };

    expect(ruleMatches(rule, makeTransaction("Transfer Out", -100))).toBe(true);
    expect(ruleMatches(rule, makeTransaction("Transfer In", 100))).toBe(true);
  });

  it("should filter by min amount", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "purchase",
      category: "Shopping",
      priority: 100,
      isActive: true,
      minAmount: 100,
    };

    expect(ruleMatches(rule, makeTransaction("Big Purchase", -150))).toBe(true);
    expect(ruleMatches(rule, makeTransaction("Small Purchase", -50))).toBe(false);
  });

  it("should filter by max amount", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "coffee",
      category: "Restaurants",
      priority: 100,
      isActive: true,
      maxAmount: 20,
    };

    expect(ruleMatches(rule, makeTransaction("Coffee", -5))).toBe(true);
    expect(ruleMatches(rule, makeTransaction("Coffee", -50))).toBe(false);
  });

  it("should filter by both min and max amount", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "purchase",
      category: "Shopping",
      priority: 100,
      isActive: true,
      minAmount: 50,
      maxAmount: 200,
    };

    expect(ruleMatches(rule, makeTransaction("Medium Purchase", -100))).toBe(true);
    expect(ruleMatches(rule, makeTransaction("Small Purchase", -30))).toBe(false);
    expect(ruleMatches(rule, makeTransaction("Big Purchase", -300))).toBe(false);
  });

  it("should return false for invalid regex", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "[invalid(regex",
      category: "Test",
      priority: 100,
      isActive: true,
    };

    const tx = makeTransaction("Test", -50);
    expect(ruleMatches(rule, tx)).toBe(false);
  });

  it("should use absolute value for amount filtering", () => {
    const rule: Rule = {
      id: "test",
      name: "Test Rule",
      description: "",
      regex: "purchase",
      category: "Shopping",
      priority: 100,
      isActive: true,
      minAmount: 50,
    };

    // Credit transactions should also be checked by absolute value
    expect(ruleMatches(rule, makeTransaction("Purchase", 100))).toBe(true);
  });
});

// ─── Rule Engine Tests (applyRules) ───────────────────────────────────────────

describe("applyRules", () => {
  it("should categorize transactions with matching rules", () => {
    const rules: Rule[] = [
      {
        id: "grocery",
        name: "Groceries",
        description: "",
        regex: "grocery",
        category: "Groceries",
        priority: 100,
        isActive: true,
      },
      {
        id: "gas",
        name: "Gas",
        description: "",
        regex: "gas",
        category: "Gas & Fuel",
        priority: 100,
        isActive: true,
      },
    ];

    const transactions: ParsedTransaction[] = [
      makeTransaction("Grocery Store", -50),
      makeTransaction("Gas Station", -30),
    ];

    const result = applyRules(transactions, rules);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].category).toBe("Groceries");
    expect(result.results[0].matchedRule?.name).toBe("Groceries");
    expect(result.results[1].category).toBe("Gas & Fuel");
    expect(result.results[1].matchedRule?.name).toBe("Gas");
    expect(result.uncategorized).toHaveLength(0);
  });

  it("should apply highest priority rule first", () => {
    const rules: Rule[] = [
      {
        id: "low",
        name: "Low Priority",
        description: "",
        regex: "store",
        category: "Shopping",
        priority: 10,
        isActive: true,
      },
      {
        id: "high",
        name: "High Priority",
        description: "",
        regex: "grocery",
        category: "Groceries",
        priority: 100,
        isActive: true,
      },
    ];

    const transactions: ParsedTransaction[] = [
      makeTransaction("Grocery Store", -50),
    ];

    const result = applyRules(transactions, rules);

    // High priority rule should win
    expect(result.results[0].category).toBe("Groceries");
    expect(result.results[0].matchedRule?.name).toBe("High Priority");
  });

  it("should leave unmatched transactions uncategorized", () => {
    const rules: Rule[] = [
      {
        id: "grocery",
        name: "Groceries",
        description: "",
        regex: "grocery",
        category: "Groceries",
        priority: 100,
        isActive: true,
      },
    ];

    const transactions: ParsedTransaction[] = [
      makeTransaction("Grocery Store", -50),
      makeTransaction("Random Thing", -10),
    ];

    const result = applyRules(transactions, rules);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].category).toBe("Groceries");
    expect(result.results[0].matched).toBe(true);
    expect(result.results[1].category).toBeNull();
    expect(result.results[1].matched).toBe(false);
    expect(result.uncategorized).toHaveLength(1);
    expect(result.uncategorized[0].transaction.description).toBe("Random Thing");
  });

  it("should count transactions by category", () => {
    const rules: Rule[] = [
      {
        id: "grocery",
        name: "Groceries",
        description: "",
        regex: "grocery",
        category: "Groceries",
        priority: 100,
        isActive: true,
      },
      {
        id: "gas",
        name: "Gas",
        description: "",
        regex: "gas",
        category: "Gas & Fuel",
        priority: 100,
        isActive: true,
      },
    ];

    const transactions: ParsedTransaction[] = [
      makeTransaction("Grocery Store", -50),
      makeTransaction("Grocery Market", -30),
      makeTransaction("Gas Station", -40),
    ];

    const result = applyRules(transactions, rules);

    expect(result.categoryCounts).toEqual({
      "Groceries": 2,
      "Gas & Fuel": 1,
    });
  });

  it("should handle empty transactions list", () => {
    const rules: Rule[] = [
      {
        id: "grocery",
        name: "Groceries",
        description: "",
        regex: "grocery",
        category: "Groceries",
        priority: 100,
        isActive: true,
      },
    ];

    const result = applyRules([], rules);

    expect(result.results).toHaveLength(0);
    expect(result.uncategorized).toHaveLength(0);
    expect(result.categoryCounts).toEqual({});
  });

  it("should handle empty rules list", () => {
    const transactions: ParsedTransaction[] = [
      makeTransaction("Grocery Store", -50),
    ];

    const result = applyRules(transactions, []);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].category).toBeNull();
    expect(result.results[0].matched).toBe(false);
    expect(result.uncategorized).toHaveLength(1);
  });

  it("should skip inactive rules", () => {
    const rules: Rule[] = [
      {
        id: "grocery",
        name: "Groceries",
        description: "",
        regex: "grocery",
        category: "Groceries",
        priority: 100,
        isActive: true,
      },
      {
        id: "gas",
        name: "Gas",
        description: "",
        regex: "gas",
        category: "Gas & Fuel",
        priority: 100,
        isActive: false,
      },
    ];

    const transactions: ParsedTransaction[] = [
      makeTransaction("Gas Station", -30),
    ];

    const result = applyRules(transactions, rules);

    // Gas rule is inactive, so no match
    expect(result.results[0].category).toBeNull();
    expect(result.results[0].matched).toBe(false);
    expect(result.uncategorized).toHaveLength(1);
  });

  it("should handle transactions with zero amount", () => {
    const rules: Rule[] = [
      {
        id: "test",
        name: "Test",
        description: "",
        regex: "test",
        category: "Test",
        priority: 100,
        isActive: true,
      },
    ];

    const transactions: ParsedTransaction[] = [
      makeTransaction("Test Transaction", 0),
    ];

    const result = applyRules(transactions, rules);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].matched).toBe(true);
  });

  it("should sort rules by priority before matching", () => {
    // Rules added in reverse priority order
    const rules: Rule[] = [
      {
        id: "low",
        name: "Low",
        description: "",
        regex: "store",
        category: "Shopping",
        priority: 10,
        isActive: true,
      },
      {
        id: "medium",
        name: "Medium",
        description: "",
        regex: "grocery store",
        category: "Groceries",
        priority: 50,
        isActive: true,
      },
      {
        id: "high",
        name: "High",
        description: "",
        regex: "grocery store",
        category: "Groceries Premium",
        priority: 100,
        isActive: true,
      },
    ];

    const transactions: ParsedTransaction[] = [
      makeTransaction("grocery store", -50),
    ];

    const result = applyRules(transactions, rules);

    // Highest priority rule should match
    expect(result.results[0].category).toBe("Groceries Premium");
    expect(result.results[0].matchedRule?.name).toBe("High");
  });

  it("should handle multiple transactions with same rule matching", () => {
    const rules: Rule[] = [
      {
        id: "coffee",
        name: "Coffee",
        description: "",
        regex: "coffee|starbucks",
        category: "Coffee",
        priority: 100,
        isActive: true,
      },
    ];

    const transactions: ParsedTransaction[] = [
      makeTransaction("Starbucks", -5),
      makeTransaction("Coffee Bean", -4),
      makeTransaction("Tea House", -3),
    ];

    const result = applyRules(transactions, rules);

    expect(result.results[0].matched).toBe(true);
    expect(result.results[1].matched).toBe(true);
    expect(result.results[2].matched).toBe(false);
    expect(result.categoryCounts).toEqual({ Coffee: 2 });
  });
});

// ─── Rule Testing (Preview) Tests ─────────────────────────────────────────────

describe("testRule", () => {
  it("should return true when rule matches transaction", () => {
    const rule: Rule = {
      id: "test",
      name: "Test",
      description: "",
      regex: "grocery",
      category: "Groceries",
      priority: 100,
      isActive: true,
    };

    const tx = makeTransaction("Grocery Store", -50);
    expect(testRule(rule, tx)).toBe(true);
  });

  it("should return false when rule does not match", () => {
    const rule: Rule = {
      id: "test",
      name: "Test",
      description: "",
      regex: "grocery",
      category: "Groceries",
      priority: 100,
      isActive: true,
    };

    const tx = makeTransaction("Gas Station", -30);
    expect(testRule(rule, tx)).toBe(false);
  });
});

describe("testRuleAgainstTransactions", () => {
  it("should return correct match count", () => {
    const rule: Rule = {
      id: "test",
      name: "Test",
      description: "",
      regex: "grocery",
      category: "Groceries",
      priority: 100,
      isActive: true,
    };

    const transactions: ParsedTransaction[] = [
      makeTransaction("Grocery Store", -50),
      makeTransaction("Grocery Market", -30),
      makeTransaction("Gas Station", -20),
    ];

    const result = testRuleAgainstTransactions(rule, transactions);

    expect(result.matches).toBe(2);
    expect(result.total).toBe(3);
    expect(result.matchedTransactions).toHaveLength(2);
  });

  it("should return zero matches when no rule matches", () => {
    const rule: Rule = {
      id: "test",
      name: "Test",
      description: "",
      regex: "grocery",
      category: "Groceries",
      priority: 100,
      isActive: true,
    };

    const transactions: ParsedTransaction[] = [
      makeTransaction("Gas Station", -30),
      makeTransaction("Electric Bill", -100),
    ];

    const result = testRuleAgainstTransactions(rule, transactions);

    expect(result.matches).toBe(0);
    expect(result.total).toBe(2);
    expect(result.matchedTransactions).toHaveLength(0);
  });

  it("should return all transactions when rule matches all", () => {
    const rule: Rule = {
      id: "test",
      name: "Test",
      description: "",
      regex: ".",
      category: "All",
      priority: 100,
      isActive: true,
    };

    const transactions: ParsedTransaction[] = [
      makeTransaction("A", -1),
      makeTransaction("B", -2),
      makeTransaction("C", -3),
    ];

    const result = testRuleAgainstTransactions(rule, transactions);

    expect(result.matches).toBe(3);
    expect(result.total).toBe(3);
    expect(result.matchedTransactions).toHaveLength(3);
  });
});

// ─── Rule Validation Tests ────────────────────────────────────────────────────

describe("validateRuleRegex", () => {
  it("should return null for valid regex", () => {
    expect(validateRuleRegex("grocery")).toBeNull();
    expect(validateRuleRegex("^[a-z]+$")).toBeNull();
    expect(validateRuleRegex(".*")).toBeNull();
  });

  it("should return error for invalid regex", () => {
    const result = validateRuleRegex("[invalid(");
    expect(result).not.toBeNull();
    expect(result).toContain("Invalid regex");
  });
});

describe("validateRule", () => {
  it("should return no errors for a valid rule", () => {
    const errors = validateRule({
      name: "Groceries",
      regex: "grocery",
      category: "Groceries",
    });
    expect(errors).toHaveLength(0);
  });

  it("should error when name is missing", () => {
    const errors = validateRule({
      regex: "grocery",
      category: "Groceries",
    });
    expect(errors).toContain("Rule name is required");
  });

  it("should error when name is empty string", () => {
    const errors = validateRule({
      name: "",
      regex: "grocery",
      category: "Groceries",
    });
    expect(errors).toContain("Rule name is required");
  });

  it("should error when regex is missing", () => {
    const errors = validateRule({
      name: "Groceries",
      category: "Groceries",
    });
    expect(errors).toContain("Regex pattern is required");
  });

  it("should error when regex is invalid", () => {
    const errors = validateRule({
      name: "Groceries",
      regex: "[invalid(",
      category: "Groceries",
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("Invalid regex");
  });

  it("should error when category is missing", () => {
    const errors = validateRule({
      name: "Groceries",
      regex: "grocery",
    });
    expect(errors).toContain("Category is required");
  });

  it("should error when min > max amount", () => {
    const errors = validateRule({
      name: "Test",
      regex: "test",
      category: "Test",
      minAmount: 200,
      maxAmount: 100,
    });
    expect(errors).toContain("Min amount must be less than or equal to max amount");
  });

  it("should not error when min <= max amount", () => {
    const errors = validateRule({
      name: "Test",
      regex: "test",
      category: "Test",
      minAmount: 50,
      maxAmount: 200,
    });
    expect(errors).toHaveLength(0);
  });

  it("should not error when only min is set", () => {
    const errors = validateRule({
      name: "Test",
      regex: "test",
      category: "Test",
      minAmount: 50,
    });
    expect(errors).toHaveLength(0);
  });

  it("should not error when only max is set", () => {
    const errors = validateRule({
      name: "Test",
      regex: "test",
      category: "Test",
      maxAmount: 200,
    });
    expect(errors).toHaveLength(0);
  });
});

// ─── Default Rules Tests ──────────────────────────────────────────────────────

describe("DEFAULT_RULES", () => {
  it("should have all rules active", () => {
    for (const rule of DEFAULT_RULES) {
      expect(rule.isActive).toBe(true);
    }
  });

  it("should have valid regex patterns", () => {
    for (const rule of DEFAULT_RULES) {
      const error = validateRuleRegex(rule.regex);
      expect(error).toBeNull();
    }
  });

  it("should have all required fields", () => {
    for (const rule of DEFAULT_RULES) {
      expect(rule.name).toBeTruthy();
      expect(rule.regex).toBeTruthy();
      expect(rule.category).toBeTruthy();
      expect(rule.priority).toBeGreaterThan(0);
    }
  });

  it("should have unique IDs", () => {
    const ids = DEFAULT_RULES.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("should categorize common transactions", () => {
    const transactions: ParsedTransaction[] = [
      makeTransaction("Whole Foods Market", -85.50),
      makeTransaction("Starbucks Coffee", -5.75),
      makeTransaction("Shell Gas Station", -45.00),
      makeTransaction("Uber Ride", -15.50),
      makeTransaction("Electric Company", -120.00),
      makeTransaction("Netflix Monthly", -15.99),
      makeTransaction("CVS Pharmacy", -12.50),
      makeTransaction("Amazon Purchase", -35.00),
      makeTransaction("Salary Deposit", 3000.00),
    ];

    const result = applyRules(transactions, DEFAULT_RULES);

    // All should be categorized (no uncategorized)
    expect(result.uncategorized).toHaveLength(0);
    expect(result.results).toHaveLength(transactions.length);

    // Check specific categorizations
    const categories = result.results.map((r) => r.category);
    expect(categories).toContain("Groceries");
    expect(categories).toContain("Restaurants");
    expect(categories).toContain("Gas & Fuel");
    expect(categories).toContain("Transportation");
    expect(categories).toContain("Utilities");
    expect(categories).toContain("Subscriptions");
    expect(categories).toContain("Health");
    expect(categories).toContain("Shopping");
    expect(categories).toContain("Income");
  });

  it("should have proper priority ordering", () => {
    const priorities = DEFAULT_RULES.map((r) => r.priority);
    const maxPriority = Math.max(...priorities);
    const minPriority = Math.min(...priorities);

    // All priorities should be positive
    expect(minPriority).toBeGreaterThan(0);
    // All should be at or below 100
    expect(maxPriority).toBeLessThanOrEqual(100);
  });
});

// ─── Bill Detection Tests ─────────────────────────────────────────────────────

describe("isBill", () => {
  it("should detect rent as a bill", () => {
    const tx = makeTransaction("Rent Payment", -1500);
    expect(isBill(tx)).toBe(true);
  });

  it("should detect mortgage as a bill", () => {
    const tx = makeTransaction("Mortgage Payment", -1200);
    expect(isBill(tx)).toBe(true);
  });

  it("should detect insurance as a bill", () => {
    const tx = makeTransaction("Auto Insurance", -85);
    expect(isBill(tx)).toBe(true);
  });

  it("should detect utility as a bill", () => {
    const tx = makeTransaction("Electric Utility", -120);
    expect(isBill(tx)).toBe(true);
  });

  it("should detect internet as a bill", () => {
    const tx = makeTransaction("Comcast Internet", -70);
    expect(isBill(tx)).toBe(true);
  });

  it("should detect Netflix as a bill", () => {
    const tx = makeTransaction("Netflix Subscription", -15.99);
    expect(isBill(tx)).toBe(true);
  });

  it("should detect Spotify as a bill", () => {
    const tx = makeTransaction("Spotify Premium", -9.99);
    expect(isBill(tx)).toBe(true);
  });

  it("should not flag a grocery store as a bill", () => {
    const tx = makeTransaction("Grocery Store", -50);
    expect(isBill(tx)).toBe(false);
  });

  it("should not flag a gas station as a bill", () => {
    const tx = makeTransaction("Gas Station", -40);
    expect(isBill(tx)).toBe(false);
  });

  it("should not flag a restaurant as a bill", () => {
    const tx = makeTransaction("Restaurant Dinner", -45);
    expect(isBill(tx)).toBe(false);
  });

  it("should be case-insensitive", () => {
    const tx = makeTransaction("RENT PAYMENT", -1500);
    expect(isBill(tx)).toBe(true);
  });

  it("should handle partial matches", () => {
    const tx = makeStringTransaction("My Rent Due on the 1st", -1500);
    expect(isBill(tx)).toBe(true);
  });
});

describe("detectBills", () => {
  it("should correctly identify bills among transactions", () => {
    const transactions: ParsedTransaction[] = [
      makeTransaction("Rent Payment", -1500),
      makeTransaction("Grocery Store", -50),
      makeTransaction("Netflix", -15.99),
      makeTransaction("Gas Station", -40),
      makeTransaction("Electric Bill", -120),
    ];

    const results = detectBills(transactions);

    expect(results[0].isBill).toBe(true);
    expect(results[1].isBill).toBe(false);
    expect(results[2].isBill).toBe(true);
    expect(results[3].isBill).toBe(false);
    expect(results[4].isBill).toBe(true);
  });

  it("should return the same number of results as input", () => {
    const transactions: ParsedTransaction[] = [
      makeTransaction("A", -1),
      makeTransaction("B", -2),
      makeTransaction("C", -3),
    ];

    const results = detectBills(transactions);
    expect(results).toHaveLength(3);
  });

  it("should handle empty input", () => {
    const results = detectBills([]);
    expect(results).toHaveLength(0);
  });
});

// ─── Helper for case-insensitive test ─────────────────────────────────────────

function makeStringTransaction(description: string, amount: number): ParsedTransaction {
  return makeTransaction(description, amount);
}
