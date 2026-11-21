/**
 * API route for budget management.
 *
 * Provides CRUD operations for budgets and budget calculation endpoints.
 */

import { NextResponse } from "next/server";
import {
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  getAllTransactions,
  getCategories,
  clearBudgets,
} from "@/lib/import/db";
import {
  calculateOverallBudget,
  validateBudget,
  type CreateBudgetInput,
  type UpdateBudgetInput,
} from "@/lib/budgets/engine";

// ─── GET: List all budgets or calculate budget summary ────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "calculate") {
      // Calculate overall budget summary
      const budgets = getBudgets();
      const transactions = getAllTransactions(100000, 0);

      const summary = calculateOverallBudget(budgets, transactions);
      return NextResponse.json({ summary });
    }

    if (action === "categories") {
      const categories = getCategories();
      return NextResponse.json({ categories });
    }

    if (action === "clear") {
      // For testing only
      clearBudgets();
      return NextResponse.json({ success: true });
    }

    const budgets = getBudgets();
    return NextResponse.json({ budgets });
  } catch (error) {
    console.error("Budgets API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets" },
      { status: 500 }
    );
  }
}

// ─── POST: Create a new budget ───────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body: CreateBudgetInput = await request.json();
    const { name, categoryId, amount, period } = body;

    if (!name || !categoryId || amount === undefined) {
      return NextResponse.json(
        { error: "name, categoryId, and amount are required" },
        { status: 400 }
      );
    }

    const validationErrors = validateBudget({ name, categoryId, amount, period: period || "monthly" });
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    const id = createBudget(name, categoryId, amount, period || "monthly");

    return NextResponse.json({
      success: true,
      id,
      budget: {
        id,
        name,
        categoryId,
        amount,
        period: period || "monthly",
      },
    });
  } catch (error) {
    console.error("Create budget error:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 500 }
    );
  }
}

// ─── PUT: Update an existing budget ──────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Budget ID is required" },
        { status: 400 }
      );
    }

    const body: UpdateBudgetInput = await request.json();
    const { name, categoryId, amount, period } = body;

    if (!name || !categoryId || amount === undefined) {
      return NextResponse.json(
        { error: "name, categoryId, and amount are required" },
        { status: 400 }
      );
    }

    const validationErrors = validateBudget({ name, categoryId, amount, period: period || "monthly" });
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    updateBudget(id, { name, categoryId, amount, period });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update budget error:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete a budget ─────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Budget ID is required" },
        { status: 400 }
      );
    }

    deleteBudget(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete budget error:", error);
    return NextResponse.json(
      { error: "Failed to delete budget" },
      { status: 500 }
    );
  }
}
