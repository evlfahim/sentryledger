/**
 * API route for safe-to-spend calculations and savings goals management.
 *
 * Provides:
 * - Safe-to-spend calculation based on income, bills, budgets, and savings goals
 * - CRUD operations for savings goals
 */

import { NextResponse } from "next/server";
import {
  getAllTransactions,
  getBudgets,
  getSavingsGoals,
  getActiveSavingsGoals,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  getSavingsGoal,
  clearSavingsGoals,
  type SavingsGoalRow,
} from "@/lib/import/db";
import {
  calculateSafeToSpend,
  validateSavingsGoal,
  getSavingsGoalProgress,
  formatCurrency,
  type SavingsGoalInput,
  type UpdateSavingsGoalInput,
} from "@/lib/safe-to-spend/engine";

// ─── GET: Safe-to-spend calculation or savings goals list ─────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Safe-to-spend calculation
    if (action === "calculate") {
      const transactions = getAllTransactions(100000, 0);
      const budgets = getBudgets();
      const savingsGoals = getActiveSavingsGoals();

      const result = calculateSafeToSpend(
        transactions,
        budgets,
        savingsGoals
      );

      return NextResponse.json({ result });
    }

    // Daily safe amount
    if (action === "daily") {
      const transactions = getAllTransactions(100000, 0);
      const budgets = getBudgets();
      const savingsGoals = getActiveSavingsGoals();

      const { calculateDailySafeAmount } = await import("@/lib/safe-to-spend/engine");
      const daily = calculateDailySafeAmount(
        transactions,
        budgets,
        savingsGoals
      );

      return NextResponse.json({ daily });
    }

    // Savings goals list
    if (action === "goals") {
      const goals = getSavingsGoals();
      const progressList = goals.map((g) => {
        const progress = getSavingsGoalProgress(g);
        return { ...progress, id: g.id };
      });
      return NextResponse.json({ goals: progressList });
    }

    // Single savings goal
    const goalId = searchParams.get("id");
    if (goalId) {
      const goal = getSavingsGoal(goalId);
      if (!goal) {
        return NextResponse.json(
          { error: "Savings goal not found" },
          { status: 404 }
        );
      }
      const progress = getSavingsGoalProgress(goal);
      return NextResponse.json({ goal: progress });
    }

    // Default: return safe-to-spend summary
    const transactions = getAllTransactions(100000, 0);
    const budgets = getBudgets();
    const savingsGoals = getActiveSavingsGoals();

    const result = calculateSafeToSpend(
      transactions,
      budgets,
      savingsGoals
    );

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Safe-to-spend API error:", error);
    return NextResponse.json(
      { error: "Failed to calculate safe-to-spend" },
      { status: 500 }
    );
  }
}

// ─── POST: Create a new savings goal ─────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body: SavingsGoalInput = await request.json();
    const { name, targetAmount, currentAmount, monthlyContribution, deadline, isActive } = body;

    if (!name || targetAmount === undefined) {
      return NextResponse.json(
        { error: "name and targetAmount are required" },
        { status: 400 }
      );
    }

    const validationErrors = validateSavingsGoal({
      name,
      targetAmount,
      currentAmount: currentAmount || 0,
      monthlyContribution: monthlyContribution || 0,
      deadline: deadline || null,
      isActive: isActive !== false,
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    const id = createSavingsGoal(
      name,
      targetAmount,
      currentAmount || 0,
      monthlyContribution || 0,
      deadline || null,
      isActive !== false
    );

    return NextResponse.json({
      success: true,
      id,
      goal: {
        id,
        name,
        targetAmount,
        currentAmount: currentAmount || 0,
        monthlyContribution: monthlyContribution || 0,
        deadline: deadline || null,
        isActive: isActive !== false,
      },
    });
  } catch (error) {
    console.error("Create savings goal error:", error);
    return NextResponse.json(
      { error: "Failed to create savings goal" },
      { status: 500 }
    );
  }
}

// ─── PUT: Update an existing savings goal ─────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Savings goal ID is required" },
        { status: 400 }
      );
    }

    const body: UpdateSavingsGoalInput = await request.json();
    const { name, targetAmount, currentAmount, monthlyContribution, deadline, isActive } = body;

    if (!name && targetAmount === undefined) {
      return NextResponse.json(
        { error: "At least name or targetAmount must be provided" },
        { status: 400 }
      );
    }

    // Validate if we have enough info
    const existing = getSavingsGoal(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Savings goal not found" },
        { status: 404 }
      );
    }

    const validationErrors = validateSavingsGoal({
      name: name || existing.name,
      targetAmount: targetAmount ?? existing.target_amount,
      currentAmount: currentAmount ?? existing.current_amount,
      monthlyContribution: monthlyContribution ?? existing.monthly_contribution,
      deadline: deadline || existing.deadline,
      isActive: isActive !== undefined ? isActive : existing.is_active === 1,
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    updateSavingsGoal(id, {
      name,
      targetAmount,
      currentAmount,
      monthlyContribution,
      deadline,
      isActive,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update savings goal error:", error);
    return NextResponse.json(
      { error: "Failed to update savings goal" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete a savings goal ────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Savings goal ID is required" },
        { status: 400 }
      );
    }

    deleteSavingsGoal(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete savings goal error:", error);
    return NextResponse.json(
      { error: "Failed to delete savings goal" },
      { status: 500 }
    );
  }
}
