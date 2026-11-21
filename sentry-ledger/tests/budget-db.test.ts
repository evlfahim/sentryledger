/**
 * Unit tests for budget database operations.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  createBudget,
  getBudget,
  getBudgets,
  updateBudget,
  deleteBudget,
  clearBudgets,
  clearAll,
  closeDb,
  createAccount,
  importTransactions,
  getAccounts,
  getAllTransactions,
  type BudgetRow,
} from "@/lib/import/db";

function randomId(): string {
  return `test-budget-${Math.random().toString(36).substring(2, 10)}`;
}

describe("budget database operations", () => {
  beforeEach(() => {
    clearAll();
  });

  afterAll(() => {
    closeDb();
  });

  describe("createBudget", () => {
    it("should create a budget and return its ID", () => {
      const id = createBudget("Groceries", "Groceries", 500, "monthly");

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should default period to monthly", () => {
      const id = createBudget("Groceries", "Groceries", 500);
      const budget = getBudget(id);

      expect(budget).toBeDefined();
      expect(budget?.period).toBe("monthly");
    });

    it("should store all budget fields correctly", () => {
      const id = createBudget("Restaurant Budget", "Restaurants", 200, "weekly");
      const budget = getBudget(id);

      expect(budget).toBeDefined();
      expect(budget?.name).toBe("Restaurant Budget");
      expect(budget?.category_id).toBe("Restaurants");
      expect(budget?.amount).toBe(200);
      expect(budget?.period).toBe("weekly");
    });
  });

  describe("getBudget", () => {
    it("should return undefined for non-existent budget", () => {
      const result = getBudget("non-existent-id");
      expect(result).toBeUndefined();
    });

    it("should return the correct budget after creation", () => {
      const id = createBudget("Groceries", "Groceries", 500, "monthly");
      const budget = getBudget(id);

      expect(budget).toBeDefined();
      expect(budget?.id).toBe(id);
      expect(budget?.name).toBe("Groceries");
    });
  });

  describe("getBudgets", () => {
    it("should return empty array when no budgets exist", () => {
      const budgets = getBudgets();
      expect(budgets).toEqual([]);
    });

    it("should return all created budgets", () => {
      createBudget("Groceries", "Groceries", 500, "monthly");
      createBudget("Restaurants", "Restaurants", 200, "monthly");
      createBudget("Gas", "Gas & Fuel", 100, "monthly");

      const budgets = getBudgets();
      expect(budgets).toHaveLength(3);
    });

    it("should order budgets by name", () => {
      createBudget("Zebra Budget", "Zebra", 100, "monthly");
      createBudget("Alpha Budget", "Alpha", 200, "monthly");
      createBudget("Middle Budget", "Middle", 300, "monthly");

      const budgets = getBudgets();
      expect(budgets[0].name).toBe("Alpha Budget");
      expect(budgets[1].name).toBe("Middle Budget");
      expect(budgets[2].name).toBe("Zebra Budget");
    });
  });

  describe("updateBudget", () => {
    it("should update budget name", () => {
      const id = createBudget("Old Name", "Groceries", 500, "monthly");
      updateBudget(id, { name: "New Name" });

      const budget = getBudget(id);
      expect(budget?.name).toBe("New Name");
    });

    it("should update budget amount", () => {
      const id = createBudget("Groceries", "Groceries", 500, "monthly");
      updateBudget(id, { amount: 750 });

      const budget = getBudget(id);
      expect(budget?.amount).toBe(750);
    });

    it("should update budget period", () => {
      const id = createBudget("Groceries", "Groceries", 500, "monthly");
      updateBudget(id, { period: "weekly" });

      const budget = getBudget(id);
      expect(budget?.period).toBe("weekly");
    });

    it("should update budget category", () => {
      const id = createBudget("Groceries", "Groceries", 500, "monthly");
      updateBudget(id, { categoryId: "Food" });

      const budget = getBudget(id);
      expect(budget?.category_id).toBe("Food");
    });

    it("should update multiple fields at once", () => {
      const id = createBudget("Old", "OldCat", 100, "monthly");
      updateBudget(id, {
        name: "New",
        categoryId: "NewCat",
        amount: 999,
        period: "yearly",
      });

      const budget = getBudget(id);
      expect(budget?.name).toBe("New");
      expect(budget?.category_id).toBe("NewCat");
      expect(budget?.amount).toBe(999);
      expect(budget?.period).toBe("yearly");
    });

    it("should not change fields not included in update", () => {
      const id = createBudget("Groceries", "Groceries", 500, "monthly");
      updateBudget(id, { name: "Updated" });

      const budget = getBudget(id);
      expect(budget?.name).toBe("Updated");
      expect(budget?.amount).toBe(500);
      expect(budget?.period).toBe("monthly");
      expect(budget?.category_id).toBe("Groceries");
    });
  });

  describe("deleteBudget", () => {
    it("should delete a budget", () => {
      const id = createBudget("Groceries", "Groceries", 500, "monthly");
      deleteBudget(id);

      const budget = getBudget(id);
      expect(budget).toBeUndefined();
    });

    it("should not fail when deleting non-existent budget", () => {
      expect(() => deleteBudget("non-existent-id")).not.toThrow();
    });
  });

  describe("clearBudgets", () => {
    it("should remove all budgets", () => {
      createBudget("Groceries", "Groceries", 500, "monthly");
      createBudget("Restaurants", "Restaurants", 200, "monthly");

      clearBudgets();

      const budgets = getBudgets();
      expect(budgets).toHaveLength(0);
    });
  });

  describe("clearAll", () => {
    it("should remove all budgets along with other data", () => {
      createBudget("Groceries", "Groceries", 500, "monthly");
      // Also create an account and transaction to verify they're cleared too
      const accountId = createAccount("Test Account", "checking", 1000);
      importTransactions(accountId, [
        { date: "2024-01-15", description: "Test", amount: -50, category: "Groceries" },
      ]);

      clearAll();

      expect(getBudgets()).toHaveLength(0);
      expect(getAccounts()).toHaveLength(0);
      expect(getAllTransactions()).toHaveLength(0);
    });
  });
});
