/**
 * Rule Database Tests
 *
 * Tests for CRUD operations on rules in the SQLite database.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  reorderRules,
  getCategories,
  clearRules,
  clearAll,
  type RuleRow,
} from "@/lib/import/db";
import {
  validateRule,
  validateRuleRegex,
  testRule,
  testRuleAgainstTransactions,
  applyRules,
  DEFAULT_RULES,
  type Rule,
} from "@/lib/rules";
import type { ParsedTransaction } from "@/lib/csv";

// ─── Helper ──────────────────────────────────────────────────────────────────

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

// ─── Setup / Teardown ────────────────────────────────────────────────────────

describe("Rule Database Operations", () => {
  beforeEach(() => {
    clearAll();
  });

  afterEach(() => {
    clearAll();
  });

  describe("createRule", () => {
    it("should create a new rule and return its ID", () => {
      const id = createRule(
        "Test Rule",
        "grocery",
        "Groceries",
        "A test rule",
        100,
        true,
        null,
        null,
        "any"
      );

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should create a rule with default values", () => {
      const id = createRule("Simple Rule", "test", "Test");

      const rule = getRule(id);
      expect(rule).toBeDefined();
      expect(rule!.name).toBe("Simple Rule");
      expect(rule!.regex).toBe("test");
      expect(rule!.category).toBe("Test");
      expect(rule!.priority).toBe(0);
      expect(rule!.is_active).toBe(1);
      expect(rule!.min_amount).toBeNull();
      expect(rule!.max_amount).toBeNull();
      expect(rule!.amount_direction).toBe("any");
    });

    it("should create a rule with amount filters", () => {
      const id = createRule(
        "Big Purchase",
        "purchase",
        "Shopping",
        "",
        50,
        true,
        100,
        500,
        "debit"
      );

      const rule = getRule(id);
      expect(rule).toBeDefined();
      expect(rule!.min_amount).toBe(100);
      expect(rule!.max_amount).toBe(500);
      expect(rule!.amount_direction).toBe("debit");
    });
  });

  describe("getRules", () => {
    it("should return empty array when no rules exist", () => {
      const rules = getRules();
      expect(rules).toHaveLength(0);
    });

    it("should return all rules ordered by priority descending", () => {
      createRule("Low Priority", "low", "Test", "", 10);
      createRule("High Priority", "high", "Test", "", 100);
      createRule("Medium Priority", "medium", "Test", "", 50);

      const rules = getRules();
      expect(rules).toHaveLength(3);
      expect(rules[0].name).toBe("High Priority");
      expect(rules[1].name).toBe("Medium Priority");
      expect(rules[2].name).toBe("Low Priority");
    });

    it("should preserve insertion order for same priority", () => {
      createRule("First", "first", "Test", "", 50);
      createRule("Second", "second", "Test", "", 50);
      createRule("Third", "third", "Test", "", 50);

      const rules = getRules();
      expect(rules[0].name).toBe("First");
      expect(rules[1].name).toBe("Second");
      expect(rules[2].name).toBe("Third");
    });
  });

  describe("getRule", () => {
    it("should return a rule by ID", () => {
      const id = createRule("Find Me", "find", "Test");
      const rule = getRule(id);

      expect(rule).toBeDefined();
      expect(rule!.name).toBe("Find Me");
    });

    it("should return undefined for non-existent ID", () => {
      const rule = getRule("non-existent-id");
      expect(rule).toBeUndefined();
    });
  });

  describe("updateRule", () => {
    it("should update a rule's name", () => {
      const id = createRule("Old Name", "test", "Test");
      updateRule(id, { name: "New Name" });

      const rule = getRule(id);
      expect(rule!.name).toBe("New Name");
    });

    it("should update a rule's regex", () => {
      const id = createRule("Test Rule", "old", "Test");
      updateRule(id, { regex: "new" });

      const rule = getRule(id);
      expect(rule!.regex).toBe("new");
    });

    it("should update a rule's category", () => {
      const id = createRule("Test Rule", "test", "Old Category");
      updateRule(id, { category: "New Category" });

      const rule = getRule(id);
      expect(rule!.category).toBe("New Category");
    });

    it("should update a rule's priority", () => {
      const id = createRule("Test Rule", "test", "Test", "", 10);
      updateRule(id, { priority: 100 });

      const rule = getRule(id);
      expect(rule!.priority).toBe(100);
    });

    it("should update a rule's active status", () => {
      const id = createRule("Active Rule", "test", "Test", "", 0, true);
      updateRule(id, { isActive: false });

      const rule = getRule(id);
      expect(rule!.is_active).toBe(0);
    });

    it("should update amount filters", () => {
      const id = createRule("Test Rule", "test", "Test");
      updateRule(id, {
        minAmount: 50,
        maxAmount: 200,
        amountDirection: "debit",
      });

      const rule = getRule(id);
      expect(rule!.min_amount).toBe(50);
      expect(rule!.max_amount).toBe(200);
      expect(rule!.amount_direction).toBe("debit");
    });

    it("should update multiple fields at once", () => {
      const id = createRule("Old", "old", "Old", "", 10, true);
      updateRule(id, {
        name: "New",
        regex: "new",
        category: "New Category",
        priority: 200,
        isActive: false,
      });

      const rule = getRule(id);
      expect(rule!.name).toBe("New");
      expect(rule!.regex).toBe("new");
      expect(rule!.category).toBe("New Category");
      expect(rule!.priority).toBe(200);
      expect(rule!.is_active).toBe(0);
    });

    it("should do nothing with empty update", () => {
      const id = createRule("Test Rule", "test", "Test", "", 50, true);
      updateRule(id, {});

      const rule = getRule(id);
      expect(rule!.name).toBe("Test Rule");
      expect(rule!.priority).toBe(50);
      expect(rule!.is_active).toBe(1);
    });
  });

  describe("deleteRule", () => {
    it("should delete a rule by ID", () => {
      const id = createRule("Delete Me", "delete", "Test");
      deleteRule(id);

      const rule = getRule(id);
      expect(rule).toBeUndefined();
    });

    it("should not error on deleting non-existent rule", () => {
      expect(() => deleteRule("non-existent")).not.toThrow();
    });

    it("should remove rule from getRules list", () => {
      createRule("Keep Me", "keep", "Test");
      const id = createRule("Delete Me", "delete", "Test");

      deleteRule(id);
      const rules = getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe("Keep Me");
    });
  });

  describe("reorderRules", () => {
    it("should reorder rules by setting priorities", () => {
      const id1 = createRule("First", "first", "Test", "", 100);
      const id2 = createRule("Second", "second", "Test", "", 90);
      const id3 = createRule("Third", "third", "Test", "", 80);

      reorderRules([
        { id: id1, priority: 80 },
        { id: id2, priority: 100 },
        { id: id3, priority: 90 },
      ]);

      const rules = getRules();
      expect(rules[0].name).toBe("Second");
      expect(rules[1].name).toBe("Third");
      expect(rules[2].name).toBe("First");
    });

    it("should handle empty updates", () => {
      createRule("Test", "test", "Test", "", 50);
      reorderRules([]);
      const rules = getRules();
      expect(rules[0].priority).toBe(50);
    });
  });

  describe("getCategories", () => {
    it("should return unique categories", () => {
      createRule("Rule 1", "test", "Groceries");
      createRule("Rule 2", "test", "Restaurants");
      createRule("Rule 3", "test", "Groceries");
      createRule("Rule 4", "test", "Gas & Fuel");

      const categories = getCategories();
      expect(categories).toEqual(["Gas & Fuel", "Groceries", "Restaurants"]);
    });

    it("should return empty array when no rules exist", () => {
      const categories = getCategories();
      expect(categories).toHaveLength(0);
    });
  });

  describe("clearRules", () => {
    it("should remove all rules", () => {
      createRule("Rule 1", "test", "Test");
      createRule("Rule 2", "test", "Test");
      clearRules();

      const rules = getRules();
      expect(rules).toHaveLength(0);
    });
  });
});

describe("Rule Engine Integration with DB", () => {
  beforeEach(() => {
    clearAll();
  });

  afterEach(() => {
    clearAll();
  });

  it("should apply DB-stored rules to transactions", () => {
    const id1 = createRule("Grocery Rule", "grocery", "Groceries", "", 100);
    const id2 = createRule("Gas Rule", "gas", "Gas & Fuel", "", 100);

    const rules = getRules();
    const dbRules: Rule[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      regex: r.regex,
      category: r.category,
      priority: r.priority,
      isActive: r.is_active === 1,
      minAmount: r.min_amount ?? undefined,
      maxAmount: r.max_amount ?? undefined,
      amountDirection: (r.amount_direction || "any") as "debit" | "credit" | "any",
    }));

    const transactions: ParsedTransaction[] = [
      makeTransaction("Grocery Store", -50),
      makeTransaction("Gas Station", -30),
      makeTransaction("Random Store", -20),
    ];

    const result = applyRules(transactions, dbRules);

    expect(result.results[0].category).toBe("Groceries");
    expect(result.results[0].matchedRule?.id).toBe(id1);
    expect(result.results[1].category).toBe("Gas & Fuel");
    expect(result.results[1].matchedRule?.id).toBe(id2);
    expect(result.results[2].category).toBeNull();
    expect(result.uncategorized).toHaveLength(1);
  });

  it("should respect rule priority from DB", () => {
    const id1 = createRule("Low Priority", "store", "Shopping", "", 10);
    const id2 = createRule("High Priority", "grocery", "Groceries", "", 100);

    const rules = getRules();
    const dbRules: Rule[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      regex: r.regex,
      category: r.category,
      priority: r.priority,
      isActive: r.is_active === 1,
    }));

    const transactions: ParsedTransaction[] = [
      makeTransaction("Grocery Store", -50),
    ];

    const result = applyRules(transactions, dbRules);

    // High priority rule should win
    expect(result.results[0].category).toBe("Groceries");
    expect(result.results[0].matchedRule?.id).toBe(id2);
  });

  it("should skip inactive rules from DB", () => {
    createRule("Active Rule", "test", "Test", "", 100, true);
    const id2 = createRule("Inactive Rule", "test", "Test", "", 100, false);

    const rules = getRules();
    const dbRules: Rule[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      regex: r.regex,
      category: r.category,
      priority: r.priority,
      isActive: r.is_active === 1,
    }));

    const transactions: ParsedTransaction[] = [
      makeTransaction("Test Transaction", -50),
    ];

    const result = applyRules(transactions, dbRules);

    expect(result.results[0].matched).toBe(true);
    expect(result.results[0].matchedRule?.id).not.toBe(id2);
  });

  it("should apply amount direction filter from DB", () => {
    createRule(
      "Credit Only",
      "deposit",
      "Income",
      "",
      100,
      true,
      undefined,
      undefined,
      "credit"
    );

    const rules = getRules();
    const dbRules: Rule[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      regex: r.regex,
      category: r.category,
      priority: r.priority,
      isActive: r.is_active === 1,
      amountDirection: (r.amount_direction || "any") as "debit" | "credit" | "any",
    }));

    const transactions: ParsedTransaction[] = [
      makeTransaction("Salary Deposit", 3000),
      makeTransaction("Deposit Refund", -100),
    ];

    const result = applyRules(transactions, dbRules);

    expect(result.results[0].category).toBe("Income");
    expect(result.results[0].matched).toBe(true);
    expect(result.results[1].category).toBeNull();
    expect(result.results[1].matched).toBe(false);
  });
});

describe("Rule Validation Integration", () => {
  it("should validate a complete rule before saving", () => {
    const errors = validateRule({
      name: "Test Rule",
      regex: "grocery",
      category: "Groceries",
    });
    expect(errors).toHaveLength(0);
  });

  it("should reject missing name", () => {
    const errors = validateRule({
      regex: "test",
      category: "Test",
    });
    expect(errors).toContain("Rule name is required");
  });

  it("should reject invalid regex", () => {
    const errors = validateRule({
      name: "Test",
      regex: "[invalid",
      category: "Test",
    });
    expect(errors.some((e) => e.includes("Invalid regex"))).toBe(true);
  });

  it("should reject min > max amount", () => {
    const errors = validateRule({
      name: "Test",
      regex: "test",
      category: "Test",
      minAmount: 200,
      maxAmount: 100,
    });
    expect(errors).toContain("Min amount must be less than or equal to max amount");
  });

  it("should allow testRule with DB-style rule", () => {
    const rule: Rule = {
      id: "db-rule",
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

  it("should allow testRuleAgainstTransactions with DB-style rule", () => {
    const rule: Rule = {
      id: "db-rule",
      name: "Test",
      description: "",
      regex: "gas",
      category: "Gas & Fuel",
      priority: 100,
      isActive: true,
    };

    const transactions: ParsedTransaction[] = [
      makeTransaction("Gas Station", -30),
      makeTransaction("Grocery Store", -50),
      makeTransaction("Gas Plus Fuel", -40),
    ];

    const result = testRuleAgainstTransactions(rule, transactions);
    expect(result.matches).toBe(2);
    expect(result.total).toBe(3);
    expect(result.matchedTransactions).toHaveLength(2);
  });

  it("should validate default rules from DB", () => {
    for (const rule of DEFAULT_RULES) {
      const errors = validateRule(rule);
      expect(errors).toHaveLength(0);
    }
  });
});
