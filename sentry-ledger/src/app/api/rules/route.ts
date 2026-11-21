/**
 * API route for rule management.
 *
 * Provides CRUD operations for categorization rules.
 */

import { NextResponse } from "next/server";
import {
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  reorderRules,
  getCategories,
} from "@/lib/import/db";
import {
  validateRule,
  validateRuleRegex,
  testRule,
  testRuleAgainstTransactions,
  DEFAULT_RULES,
  type Rule,
} from "@/lib/rules";
import type { ParsedTransaction } from "@/lib/csv";

// ─── GET: List all rules ─────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "categories") {
      const categories = getCategories();
      return NextResponse.json({ categories });
    }

    if (action === "test") {
      // Test a rule against sample transactions
      const name = searchParams.get("name");
      const regex = searchParams.get("regex");
      const category = searchParams.get("category");
      const priority = searchParams.get("priority");
      const isActive = searchParams.get("isActive");
      const minAmount = searchParams.get("minAmount");
      const maxAmount = searchParams.get("maxAmount");
      const amountDirection = searchParams.get("amountDirection");

      if (!name || !regex || !category) {
        return NextResponse.json(
          { error: "name, regex, and category are required for testing" },
          { status: 400 }
        );
      }

      const rule: Rule = {
        id: "test",
        name,
        description: "",
        regex,
        category,
        priority: priority ? parseInt(priority) : 0,
        isActive: isActive !== "false",
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
        amountDirection: (amountDirection as "debit" | "credit" | "any" | undefined) || "any",
      };

      // Use sample transactions for testing
      const sampleTransactions: ParsedTransaction[] = [
        { date: "2024-01-15", description: "Grocery Store", amount: "-50.00", amountValue: -50, dateValue: new Date("2024-01-15"), isCredit: false },
        { date: "2024-01-16", description: "Starbucks Coffee", amount: "-5.50", amountValue: -5.5, dateValue: new Date("2024-01-16"), isCredit: false },
        { date: "2024-01-17", description: "Gas Station", amount: "-40.00", amountValue: -40, dateValue: new Date("2024-01-17"), isCredit: false },
        { date: "2024-01-18", description: "Salary Deposit", amount: "3000.00", amountValue: 3000, dateValue: new Date("2024-01-18"), isCredit: true },
        { date: "2024-01-19", description: "Netflix Subscription", amount: "-15.99", amountValue: -15.99, dateValue: new Date("2024-01-19"), isCredit: false },
        { date: "2024-01-20", description: "Amazon Purchase", amount: "-29.99", amountValue: -29.99, dateValue: new Date("2024-01-20"), isCredit: false },
        { date: "2024-01-21", description: "Uber Ride", amount: "-12.50", amountValue: -12.5, dateValue: new Date("2024-01-21"), isCredit: false },
        { date: "2024-01-22", description: "Electric Bill", amount: "-85.00", amountValue: -85, dateValue: new Date("2024-01-22"), isCredit: false },
        { date: "2024-01-23", description: "Transfer from Savings", amount: "500.00", amountValue: 500, dateValue: new Date("2024-01-23"), isCredit: true },
        { date: "2024-01-24", description: "Pharmacy", amount: "-25.00", amountValue: -25, dateValue: new Date("2024-01-24"), isCredit: false },
      ];

      const matchResult = testRuleAgainstTransactions(rule, sampleTransactions);
      const validationResult = validateRule(rule);

      return NextResponse.json({
        matches: matchResult.matches,
        total: matchResult.total,
        validation: validationResult,
        sampleMatches: matchResult.matchedTransactions,
      });
    }

    if (action === "default") {
      return NextResponse.json({ rules: DEFAULT_RULES });
    }

    const rules = getRules();
    return NextResponse.json({
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        regex: r.regex,
        category: r.category,
        priority: r.priority,
        isActive: r.is_active === 1,
        minAmount: r.min_amount,
        maxAmount: r.max_amount,
        amountDirection: r.amount_direction || "any",
      })),
    });
  } catch (error) {
    console.error("Rules API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

// ─── POST: Create a new rule ─────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, regex, category, description, priority, isActive, minAmount, maxAmount, amountDirection } = body;

    if (!name || !regex || !category) {
      return NextResponse.json(
        { error: "name, regex, and category are required" },
        { status: 400 }
      );
    }

    const validationErrors = validateRule({ name, regex, category, minAmount, maxAmount });
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    const id = createRule(
      name,
      regex,
      category,
      description || "",
      priority || 0,
      isActive !== false,
      minAmount || null,
      maxAmount || null,
      amountDirection || "any"
    );

    return NextResponse.json({
      success: true,
      id,
      rule: {
        id,
        name,
        description: description || "",
        regex,
        category,
        priority: priority || 0,
        isActive: isActive !== false,
        minAmount: minAmount || null,
        maxAmount: maxAmount || null,
        amountDirection: amountDirection || "any",
      },
    });
  } catch (error) {
    console.error("Create rule error:", error);
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 }
    );
  }
}

// ─── PUT: Update an existing rule ────────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Rule ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, regex, category, description, priority, isActive, minAmount, maxAmount, amountDirection } = body;

    if (!name || !regex || !category) {
      return NextResponse.json(
        { error: "name, regex, and category are required" },
        { status: 400 }
      );
    }

    const validationErrors = validateRule({ name, regex, category, minAmount, maxAmount });
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    updateRule(id, {
      name,
      description,
      regex,
      category,
      priority,
      isActive,
      minAmount,
      maxAmount,
      amountDirection,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update rule error:", error);
    return NextResponse.json(
      { error: "Failed to update rule" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete a rule ───────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Rule ID is required" },
        { status: 400 }
      );
    }

    deleteRule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete rule error:", error);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 }
    );
  }
}

// ─── PATCH: Reorder rules ────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 }
      );
    }

    reorderRules(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reorder rules error:", error);
    return NextResponse.json(
      { error: "Failed to reorder rules" },
      { status: 500 }
    );
  }
}
